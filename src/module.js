'use strict';

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
			adapter: 'iaAuthAdapter.Dummy',
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
						}])
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
						}, function(err) {
							if (err === 'credentials') {
								$rootScope.$broadcast(ia_AUTH_EVENT.loginFailed);
							} else {
								throw err;
							}
						});
				};

				/**
				 * Triggers a logout tentative.
				 * @returns {Promise}
				 */
				me.logout = function() {
					var previousUserData = angular.copy(iaAuthSession.data());
					return authAdapter.logout.apply(authAdapter, arguments)
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
				me.isAuthorized = function(roles) {
					if (roles) {
						if (me.isAuthenticated()) {
							// TODO roles
							return true;
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
						if (state.data) {
							if (state.data.restricted) {
								return me.isAuthenticated() && me.isAuthorized(state.data.roles);
							} else {
								return true;
							}
						} else {
							return true;
						}
					}
				};

				var resolved = false;
				/**
				 * Helper method to resolve identity on first access trial to a restricted
				 * state.
				 *
				 * @returns {Promise}
				 */
				me.resolve = function() {
					var me = this,
						toState = $state.toState;

					if (resolved && me.isAuthenticated() && me.isAuthorizedState(toState)) {
						return $q.when();
					}

					if (toState) {
						var data = toState.data;
						if (data) {
							return $q(function(resolve, reject) {
								if (me.isAuthenticated()) {
									// TODO TODO TODO
									if (me.isAuthorizedState(toState)) {
										resolve();
										// REM
										//$rootScope.$broadcast(ia_AUTH_EVENT.resolved);
										resolved = true;
										// TODO 1ms may not be enough on any platform (if the change event
										// is caught before this promise is done resolving, we will get back
										// here because of the redirect -- hence infinite loop)
										$timeout(function() {
											$rootScope.$broadcast(ia_AUTH_EVENT.change, me.identity(), null);
										}, 1);
									} else {
										reject({
											module: 'ia.auth',
											type: 'forbidden'
										});
									}
								} else {
									reject({
										module: 'ia.auth',
										type: 'unauthorized'
									});
								}
							});
						} else {
							throw new Error('Missing data for state ' + toState.name);
						}
					} else {
						throw new Error('Illegal State ($state.toState is missing)');
					}
				};
			}
		};
	})
	// REM
	//.run(function($rootScope, $state, iaAuth) {
	//	$rootScope.$on('$stateChangeError', function (event, toState, toParams, fromState, fromParams, error) {
	//		var config = iaAuth.config();
	//
	//		if (error && error.module === 'ia.auth') {
	//			if (error.type = 'unauthorized') {
	//				handle(function() {
	//					iaAuth.returnToState = $state.toState;
	//					iaAuth.returnToStateParams = $state.toStateParams;
	//					$state.go(config.loginState, config.loginStateParams);
	//				});
	//			} else if (error.type = 'forbidden') {
	//				handle(function() {
	//					$state.go(config.forbiddenState, config.forbiddenStateParams);
	//				});
	//			}
	//		}
	//
	//		function handle(fn) {
	//			event.preventDefault();
	//			error.handled = true;
	//			fn();
	//		}
	//	});
	//})
;
