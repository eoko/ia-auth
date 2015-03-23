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
										   ia_AUTH_EVENT, iaAuthHelper, $injector) {
			return new iaAuth();

			function iaAuth() {
				var me = this;

				me.events = ia_AUTH_EVENT;

				me.config = configure;

				me.helper = iaAuthHelper;

				var authAdapter = me.adapter = function resolveAdapter(adapter) {
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

				/**
				 * Trigger a login tentative with the provided credentials.
				 * @param {Object} credentials
				 * @returns {Promise}
				 */
				me.login = function(credentials) {
					var previousUserData = angular.copy(iaAuthSession.data());
					return authAdapter.login.apply(authAdapter, arguments)
						.then(function() {
							return authAdapter.resolveIdentity();
						})
						.then(function(userData) {
							iaAuthSession
								.create(userData)
								.then(function() {
									$rootScope.$broadcast(ia_AUTH_EVENT.login, userData);
									// REM
									//$rootScope.$broadcast(ia_AUTH_EVENT.resolved);
									if (!authAdapter.isSameAuth(previousUserData, userData)) {
										$rootScope.$broadcast(ia_AUTH_EVENT.change, userData, previousUserData);
									}
								});
						})
						.finally(function() {
							// TODO maybe the error should be more specific?
							$rootScope.$broadcast(ia_AUTH_EVENT.loginFailed);
						});
				};

				/**
				 * Triggers a logout tentative.
				 * @returns {Promise}
				 */
				me.logout = function() {
					var previousUserData = angular.copy(iaAuthSession.data());
					return $q.when(
						me.isAuthenticated()
							? authAdapter.logout.apply(authAdapter, arguments)
							: true
					)
						.then(function() {
							return iaAuthSession.destroy();
						})
						.then(function() {
							$rootScope.$broadcast(ia_AUTH_EVENT.logout);
							$rootScope.$broadcast(ia_AUTH_EVENT.change, null, previousUserData);
						});
				};

				me.identity = function() {
					return iaAuthSession.data();
				};

				me.roles = function() {
					return me.adapter.parseRoles(me.identity());
				};

				/**
				 * Returns true if the current user is authenticated (that is, after a
				 * login tentative has been successful **and** has returned an identity
				 * -- i.e. some user data.
				 * @returns {boolean}
				 */
				me.isAuthenticated = function() {
					var user = me.identity();
					return !!user;
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

				// as long as identity has not been resolved (ie. read from client-side session),
				// restricted routes won't be allow to resolve
				me.resolved = false;
				me.resolveIdentity = function resolveIdentity() {
					var previousUserData = angular.copy(iaAuthSession.data());
					return authAdapter.resolveIdentity()
						.finally(function() {
							me.resolved = true;
						})
						.then(function(userData) {
							if (!authAdapter.isSameAuth(previousUserData, userData)) {
								$rootScope.$broadcast(ia_AUTH_EVENT.change, userData, previousUserData);
							}
						});
				}
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
	.run(function($rootScope, $state, iaAuth) {
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
				if (iaAuth.resolved) {
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
					iaAuth.resolveIdentity().then(function() {
						$state.go(toState, toParams);
					}, function(err) {
						if (err && err.type === 'ia-auth:unauthenticated') {
							// that will trigger auth logic now that we are resolved
							$state.go(toState, toParams);
						} else {
							throw err;
						}
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