'use strict';

angular.module('ia.auth', [
	'ui.router',
]);

angular.module('ia.auth')
	.constant('ia_AUTH_EVENT', {
		login: 'ia-auth-login',
		loginFailed: 'ia-auth-login-failed',
		logout: 'ia-auth-logout',
		// fired from resolve
		auth: 'ia-auth-auth',
		noAuth: 'ia-auth-no-auth'
	})
	.service('iaAuth', function($q, $state, iaAuthSession, iaAuthAdapter, $rootScope, ia_AUTH_EVENT) {
		var me = this;

		me.login = function() {
			return iaAuthAdapter.login.apply(iaAuthAdapter, arguments)
				.then(function(userData) {
					iaAuthSession.create(userData);
					$rootScope.$broadcast(ia_AUTH_EVENT.login, userData);
				}, function(err) {
					if (err === 'credentials') {
						$rootScope.$broadcast(ia_AUTH_EVENT.loginFailed)
					} else {
						throw err;
					}
				});
		};

		/**
		 * @returns {Promise}
		 */
		me.logout = function() {
			return iaAuthAdapter.logout.apply(iaAuthAdapter, arguments)
				.then(function() {
					return iaAuthSession.destroy();
				})
				.then(function() {
					$rootScope.$broadcast(ia_AUTH_EVENT.logout);
				});
		};

		me.isAuthenticated = function() {
			var user = iaAuthSession.data();
			return !!user;
		};

		me.isAuthorized = function(roles) {
			if (roles) {
				if (me.isAuthenticated()) {
					// TODO roles
					return true;
				} else {
					return false;
				}
			} else {
				return true;
			}
		};

		me.resolve = function() {
			var me = this,
				toState = $state.toState;
			if (toState) {
				var data = toState.data,
					roles = data && data.roles;
				if (data) {
					return $q(function(resolve, reject) {
						if (me.isAuthenticated()) {
							// TODO TODO TODO
							if (me.isAuthorized(roles)) {
								resolve();
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
	})
	.run(function($rootScope, $state) {
		$rootScope.$on('$stateChangeError', function (event, toState, toParams, fromState, fromParams, error) {
			if (error && error.module === 'ia.auth') {
				if (error.type = 'unauthorized') {
					handle(function() {
						$state.returnToState = $state.toState;
						$state.returnToStateParams = $state.toStateParams;
						$state.go('login');
					});
				} else if (error.type = 'forbidden') {
					handle(function() {
						$state.go('forbidden');
					});
				}
			}

			function handle(fn) {
				event.preventDefault();
				error.handled = true;
				fn();
			}
		});
	})
	.run(function($rootScope, ia_AUTH_EVENT, $state) {
		$rootScope.$on(ia_AUTH_EVENT.identitySuccess, function() {
			$state.go($state.returnToState, $state.returnToStateParams);
		});
		$rootScope.$on(ia_AUTH_EVENT.logout, function() {
			var data = $state.current.data;
			if (data.restricted) {
				$state.go('login');
			}
		});
	})
	.controller('ia.auth.LoginController', function($scope, iaAuth) {
		$scope.login = function() {
			return iaAuth.login($scope.credentials);
		};
	})
;
