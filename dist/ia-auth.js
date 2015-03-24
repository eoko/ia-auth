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
	.constant('iaAuthERROR', {
		is: function(err, type) {
			return err && (err === type || err.type === type || (err instanceof Error && err.message === type));
		},
		invalidCredentials: 'ia.auth:invalid-creds',
		invalidAuthData: 'ia.auth:auth-data-invalid'
	})
	.provider('iaAuth', function iaAuthProvider() {

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

		this.config = configure;

		function configure(cfg) {
			if (arguments.length === 0) {
				return config;
			} else {
				angular.extend(config, cfg);
			}
		}

		this.$get = function iaAuthFactory($q, $state, iaAuthSession, $rootScope, $timeout,
										   ia_AUTH_EVENT, iaAuthHelper, $injector, iaAuthERROR) {

			var logger = window.console || {
					log: function() {},
					warn: function() {},
					error: function() {}
				};

			return new iaAuth();

			function iaAuth() {
				var me = this;

				var events = me.events = ia_AUTH_EVENT;

				me.config = configure;

				me.helper = iaAuthHelper;

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
						})
						.then(function() {
							return adapter.login.apply(adapter, args);
						})
						.then(function(authData) {
							_authData = authData;
							return $q.all([
								// load user data
								adapter.resolveUserData(authData),
								// persist auth data to session
								session.authData(authData)
							]).then(function(result) {
								// persist user data to session (actually, offers the
								// opportunity to do so to the session implementation)
								return session.userData(result[0])
									.then(function() {
										return result[0];
									});
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
				};

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
							} else {
								// we've got something unexpected here, we can't consider
								// that auth is resolved
								logger.error('Identity resolution failed because of unexpected error', err);
								throw err;
							}
						})
					;
				};

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
					var args = arguments,
						previousUserData;
					return copySessionUserData()
						.then(function(userData) {
							previousUserData = userData;
							return me.isAuthenticated();
						})
						.then(function(authenticated) {
							if (authenticated) {
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
						})
					;
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
	})
;

'use strict';

angular.module('ia.auth')
	.constant('iaAuthHelper', {
		areSameRoles: function areSameRoles(roles1, roles2) {
			if (roles1 === roles2) {
				return true;
			} else {
				if (roles1) {
					if (roles2 && roles1.length == roles2.length) {
						return roles1.every(function(role) {
							return roles2.indexOf(role) !== -1;
						});
					}
				} else if (!roles2) {
					return true;
				}
			}
			return true;
		},
		/**
		 * Returns true if the given role string is found in the passed roles array.
		 *
		 * If role is null, false, or undefined, then the function will always return true.
		 *
		 * If role has a value, but roles is not an array, then the function will always
		 * return false.
		 *
		 * @param {string[]} requiredRoles
		 * @param {string} testedRoles
		 * @returns {boolean}
		 */
		rolesContains: function(requiredRoles, testedRoles) {
			if (testedRoles === null || testedRoles === undefined || testedRoles === false) {
				return true;
			} else if (angular.isArray(requiredRoles)) {
				if (angular.isArray(testedRoles)) {
					return requiredRoles.some(function(role) {
						return testedRoles.indexOf(role) !== -1;
					});
				} else {
					return angular.isArray(requiredRoles) && requiredRoles.indexOf(testedRoles) !== -1;
				}
			} else {
				throw new Error('Illegal Argument (requiredRoles must be an array or falsy.');
			}
		},
		isStateRestricted: function(state) {
			return state && state.data && state.data.restricted;
		},
		parseStateRoles: function(state) {
			return state && state.data && state.data.roles;
		}
	})
;

'use strict';

angular.module('ia.auth')
	// state redirections
	.run(function($rootScope, $state, iaAuth, iaAuthERROR) {
		var events = iaAuth.events,
			config = iaAuth.config();

		// forget return state on any state change
		$rootScope.$on('$stateChangeStart', function onStateChangeStart(event, toState, toParams) {
			if (toState.name === config.loginState) {
				if (iaAuth.isAuthenticated()) {
					event.preventDefault();
					$state.go(config.indexState, config.indexStateParams);
				}
			} else if (iaAuth.helper.isStateRestricted(toState)) {
				if (iaAuth.isResolved()) {
					if (!iaAuth.isAuthorizedState(toState)) {
						if (iaAuth.isAuthenticated()) {
							event.preventDefault();
							$state.go(config.forbiddenState, config.forbiddenStateParams);
						} else {
							event.preventDefault();
							iaAuth.returnToState = toState;
							iaAuth.returnToStateParams = toParams;
							$state.go(config.loginState, config.loginStateParams);
						}
					}
				} else {
					event.preventDefault();
					// resolveIdentity resolves when auth state is known, authenticated or not,
					// so we only need to handle success and we let failures (ie. unexpected
					// errors) bubble up
					iaAuth.resolveIdentity().then(function() {
						// retry our state transition. this time, we'll pass in the resolved logic
						$state.go(toState, toParams);
					});
				}
			}
		});

		$rootScope.$on(events.change, function() {
			// redirect to return or index page on login (or resolve auth),
			// and index, return, or forbidden page on logout (or resolve no auth)
			if (config.redirectOnChange) {
				var redirected;
				if (iaAuth.isAuthenticated()) {
					redirected = redirect([
						[iaAuth.returnToState, iaAuth.returnToStateParams],
						[config.indexState, config.indexStateParams],
						[config.loginState, config.loginStateParams]
					]);
				}
				if (!redirected && !iaAuth.isAuthorizedState($state.current)) {
					redirect([
						[config.indexState, config.indexStateParams],
						[iaAuth.returnToState, iaAuth.returnToStateParams],
						[config.loginState, config.loginStateParams]
					]);
				}
			}
			// publish user data
			var publish = config.publishUserData;
			if (publish) {
				var userData = iaAuth.identity();
				if (angular.isString(publish)) {
					$rootScope[publish] = userData || null;
				} else if (angular.isObject(publish)) {
					angular.forEach(publish, function(v, k) {
						$rootScope[k] = userData && userData[k] || null;
					});
				}
			}
		});

		function redirect(state, params) {
			if (angular.isArray(state)) {
				return state.some(function(args) {
					return args && redirect.apply(null, args);
				});
			} else if (state && iaAuth.isAuthorizedState(state)) {
				$state.go(state, params);
				return true;
			}
		}
	})
;
