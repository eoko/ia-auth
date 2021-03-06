'use strict';

/**
 * Simple auth for ui.router.
 *
 * @see https://medium.com/opinionated-angularjs/techniques-for-authentication-in-angularjs-applications-7bbf0346acec
 */
angular.module('ia.auth', [
	'ui.router'
]);

angular.module('ia.auth')
	.constant('ia_AUTH_EVENT', {
		login: 'ia-auth-login',
		loginFailed: 'ia-auth-login-failed',
		logout: 'ia-auth-logout',
		// fired from resolve
		resolved: 'ia-auth-resolved',
		// fired when auth changes (see iaAuthAdapter)
		change: 'ia-auth-change',
		// fired when
		redirect: 'ia-auth-redirect'
	})
	.provider('iaAuth', function iaAuthProvider() {

		this.config = configure;
		/**
		 * Restangular interceptor to add authorization header(s) to outgoing
		 * requests.
		 */
		this.restangularRequestInterceptor = restangularRequestInterceptor;

		var config = {
			/**
			 * State used as index of the application. Used for redirect.
			 */
			indexState: 'index',
			indexStateParams: undefined,
			/**
			 * State used as the login page of the application. Used for redirect.
			 */
			loginState: 'login',
			loginStateParams: undefined,
			/**
			 * State used as the forbidden page of the application. Used for redirect.
			 */
			forbiddenState: 'forbidden',
			forbiddenStateParams: undefined,
			/**
			 * State used instead of `indexState` for authenticated users.
			 */
			restrictedIndex: undefined,
			restrictedIndexParams: undefined,
			/**
			 * @cfg {String|Object} Auth adapter. Can be the name of a service or an object,
			 * that must implements the following interface:
			 *
			 *     {
			 *         login: function(credentials) {},
			 *         logout: function() {},
			 *         isSameAuth: function(userData1, userData2) {}
			 *     }
			 *
			 * `login(credentials)`
			 *
			 * Triggers a login tentative with the provided credentials (that are the same that
			 * are passed to the `iaAuth.login` method).
			 *
			 * Returns a promise that resolves with the user data (aka. identity) if the login is
			 * successful, or is rejected if the tentative fails.
			 *
			 * `logout()`
			 *
			 * Triggers a logout tentative, and returns a promise that resolve if it is successful
			 * and is rejected otherwise.
			 *
			 * `isSameAuth(userData1, userData2)`
			 *
			 * Identity function between two identity, as represented by the userData object that
			 * was originally provided by the login method.
			 *
			 * The identity must be considered different if any of the user itself, or its roles
			 * change. You can use the `areSameRoles` helper function to compare roles array.
			 *
			 * Example:
			 *
			 *     module.factory('myAuthAdapter', function(iaAuth) {
			 *         return {
			 *             // ...
			 *             isSameAuth: function(auth1, auth2) {
			 *                 return auth1 === auth2
			 *                     || !auth1 && !auth2
			 *                     || auth1.id = auth2.id
			 *                         && iaAuth.helper.areSameRoles(auth1.roles, auth2.roles);
			 *             }
			 *         };
			 *     });
			 */
			adapter: 'iaAuthAdapter',
			/**
			 * True to redirect on auth change.
			 *
			 * This option only regards the cases when the user's auth characteristics change; not
			 * the cases where the user tries to navigate to a state that they don't have access to.
			 *
			 * The user will be redirected in two cases:
			 *
			 *   - First, if they are on a state that they don't have access anymore
			 *     after the auth change, then they will be redirected to the index state.
			 *
			 *   - Second, if they are on the login page and they are authenticated
			 *     following the auth change, then they will be redirected to the `returnToState`
			 *     (that is the state they were before landing on the login state) -- provided
			 *     there is one and they have access to it, else they'll be redirected to the
			 *     `indexState`.
			 */
			redirectOnChange: true,
			/**
			 * Whether to publish the user data (identity) to the $rootScope automatically.
			 *
			 * If specified as a falsey value, then nothing will be done.
			 *
			 * If specified as a string, then the whole user data object (the original) will
			 * be attached to the $rootScope with this string as key.
			 *
			 * If specified as a key:string value map object, then each key in the user data object
			 * will be published as the matching value key in the $rootScope.
			 *
			 * Example:
			 *
			 *     // publishes userData.user to $rootScope.user
			 *     iaAuth.config({
			 *         publishUserData: {
			 *             user: 'user'
			 *         }
			 *     });
			 *
			 * @cfg {string|object}
			 */
			publishUserData: 'user',
		};

		function configure(cfg) {
			if (arguments.length === 0) {
				return config;
			} else {
				angular.extend(config, cfg);
			}
		}

		var instance = null;
		this.$get = function iaAuthFactory($q, $state, iaAuthSession, $rootScope, $timeout,
			ia_AUTH_EVENT, iaAuthHelper, $injector, iaAuthERROR) {

			var logger = window.console || {
					log: function() {},
					warn: function() {},
					error: function() {}
				};

			return instance = new iaAuth();

			function iaAuth() {
				var me = this;

				var events = me.events = ia_AUTH_EVENT;

				me.config = configure;

				me.helper = iaAuthHelper;
				me.error = iaAuthERROR;

				var adapter = me.adapter = function resolveAdapter(adapter) {
					if (angular.isString(adapter)) {
						return $injector.invoke([adapter, function(adapter) {
							return adapter;
						}]);
					} else if (angular.isFunction(adapter)) {
						return adapter();
					} else {
						return adapter;
					}
				}(me.config().adapter);

				// TODO make it configurable? (considering it is already _injectable_)
				var session = iaAuthSession;

				var _resolved = false,
					_authData = null,
					_userData = null;

				// once resolved, authentication and authorization methods will resolve
				// synchronously (which is required for ui.router access control)
				me.isResolved = function() {
					return _resolved;
				};

				/**
				 * Returns authorization header(s) for the current auth data. It
				 * should be checked that the auth data are indeed available
				 * before calling this method, because it doesn't do the check
				 * itself.
				 *
				 * It is called with the arguments of the request interceptor
				 * wrapped in an array.
				 *
				 * @param {Array} args
				 * @returns {Object}
				 */
				me.authorizationHeaders = function(args) {
					var headers = adapter.authorizationHeaders(_authData, args);
					if (angular.isString(headers)) {
						var result = {},
							parts = headers.split(':');
						result[parts[0].trim()] = parts[1].trim();
						return result;
					} else {
						return headers;
					}
				};

				/**
				 * Trigger a login tentative with the provided credentials.
				 * @param {Object} credentials
				 * @returns {Promise}
				 */
				me.login = function(credentials) {
					var args = arguments,
						previousUserData;
					return copySessionUserData()
						.then(function(userData) {
							previousUserData = userData;
							return adapter.login.apply(adapter, args);
						})
						.then(function(authData) {
							_authData = authData;
							if (authData === null) {
								throw null;
							} else {
								return $q.all([
									// load user data
									adapter.resolveUserData(authData),
									// persist auth data to session
									session.authData(authData)
								])
									.then(function(result) {
										// persist user data to session (actually, offers the
										// opportunity to do so to the session implementation)
										return session.userData(result[0])
											.then(function() {
												return result[0];
											});
									})
									.then(function(userData) {
										_userData = userData;
										_resolved = true;
										$rootScope.$broadcast(ia_AUTH_EVENT.login, userData);
										$rootScope.$broadcast(ia_AUTH_EVENT.change, userData, previousUserData);
									})
									.catch(function(err) {
										if (iaAuthERROR.is(err, iaAuthERROR.invalidCredentials)) {
											$rootScope.$broadcast(ia_AUTH_EVENT.loginFailed);
										}
										throw err;
									})
								;
							}
						})
					;
				};

				var identityResolving = false;
				/**
				 * Reads stored identity (i.e. auth + user data), and resolve when auth state is
				 * known; that is, when authentication and authorization can be resolved synchronously.
				 *
				 * The returned promise will resolve whether we have an authenticated user or not.
				 * Use `iaAuth.isAuthenticated()` after the promise has resolved to get the information.
				 *
				 * If the promise is rejected, that means we have encountered an unexpected error.
				 *
				 * @returns {$q.Promise}
				 */
				me.resolveIdentity = function resolveIdentity() {
					if (!identityResolving) {
						identityResolving = true;
						doResolveIdentity();
					}
				};

				function doResolveIdentity() {
					// read session's auth data
					return session.authData()
						.then(function(authData) {
							if (authData == null) {
								// nothing stored in session, we're done
								return $q.reject(iaAuthERROR.invalidAuthData);
							} else {
								// else validate it
								return adapter.validateAuthData(authData);
							}
						})
						.then(function(authData) {
							if (authData == null) {
								return $q.reject(iaAuthERROR.invalidAuthData);
							} else {
								return authData;
							}
						})
						.then(function(authData) {
							// we've got valid auth data, store it
							_authData = authData;
							// now, let's obtain user data
							return session.userData()
								.then(function(userData) {
									return adapter.resolveUserData(authData, userData);
								})
								.then(function(userData) {
									// we've got everything we need, cool
									// we're authenticated & resolved
									// let's store this result
									_userData = userData;
									_resolved = true;
									// and broadcast it
									$rootScope.$broadcast(events.change, _userData, null);
									// finally, let the promise resolve with undefined
								});
						})
						.catch(function(err) {
							if (iaAuthERROR.is(err, iaAuthERROR.invalidAuthData)) {
								_authData = _userData = null;
								_resolved = true;
								// let the promise resolve with undefined
								$rootScope.$broadcast(events.change, null, null);
							} else {
								// we've got something unexpected here, we can't consider
								// that auth is resolved
								logger.error('Identity resolution failed because of unexpected error', err);
								throw err;
							}
						})
					;
				}

				/**
				 * Reads current user data from session, reducing any error to warning, and
				 * returns a copy of the original object if it exists.
				 * @returns {$q.Promise}
				 */
				function copySessionUserData() {
					return session.userData()
						.then(function(userData) {
							return angular.copy(userData);
						}, function(err) {
							// we don't really care about previous user data, so let's just
							// warn about it and continue
							logger.warn('Retrieving old user data from session failed', err);
							return null;
						});
				}

				/**
				 * Triggers a logout tentative.
				 * @returns {Promise}
				 */
				me.logout = function() {
					var args = Array.prototype.slice.call(arguments, 0),
						previousUserData;
					return copySessionUserData()
						.then(function(userData) {
							previousUserData = userData;
							return me.isAuthenticated();
						})
						.then(function(authenticated) {
							if (authenticated) {
								args.unshift(_authData);
								return adapter.logout.apply(adapter, args);
							}
						})
						.then(function() {
							_authData = _userData = null;
							return session.clear();
						})
						.then(function() {
							$rootScope.$broadcast(events.logout);
							$rootScope.$broadcast(events.change, null, previousUserData);
						});
				};

				me.identity = function() {
					return _userData;
				};

				me.roles = function() {
					return adapter.parseRoles(_userData);
				};

				/**
				 * Returns true if the current user is authenticated, that is if we have
				 * some valid auth data.
				 *
				 * @returns {boolean}
				 */
				me.isAuthenticated = function() {
					return !!_authData;
				};

				/**
				 * Returns true if the current user (necessarily identified) is authorized
				 * for any of the given roles. If roles is a falsy value, then this method
				 * will always return true for an authenticated user, and false for an
				 * unauthenticated one.
				 *
				 * @param {string[]|null} roles
				 * @returns {boolean}
				 */
				me.isAuthorizedRole = function(roles) {
					if (roles) {
						if (me.isAuthenticated()) {
							return me.helper.rolesContains(roles, me.roles());
						} else {
							return false;
						}
					} else {
						return me.isAuthenticated();
					}
				};

				/**
				 * Returns true if the current user (authorized or not) is authorized for the
				 * given state.
				 *
				 * @param {string|Object} state
				 * @returns {boolean}
				 */
				me.isAuthorizedState = function(state) {
					if (angular.isString(state)) {
						return me.isAuthorizedState($state.get(state));
					} else {
						if (me.helper.isStateRestricted(state)) {
							return me.isAuthenticated()
								&& me.isAuthorizedRole(me.helper.parseStateRoles(state));
						} else {
							return true;
						}
					}
				};
			}
		};

		function restangularRequestInterceptor(data, operation, what, url, headers) {
			if (instance && instance.isAuthenticated()) {
				var authHeaders = instance.authorizationHeaders(
					Array.prototype.slice.call(arguments, 0)
				);
				if (authHeaders) {
					return {
						headers: angular.extend({}, authHeaders, headers)
					};
				}
			}
		}
	})
;
