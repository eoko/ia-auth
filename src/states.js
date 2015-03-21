'use strict';

angular.module('ia.auth')
	/**
	 * Declares "ia-restricted" route to be used as parent for restricted states.
	 *
	 * Examples:
	 *
	 *     // State will be restricted to authenticated users (any roles)
	 *     $state.state('restrictedState', {
	 *         parent: 'ia-restricted'
	 *     });
	 *
	 *     // Restrict to some roles
	 *     $state.state('ia-restricted.restrictedState', {
	 *         data: {
	 *             roles: ['user', 'admin']
	 *         }
	 *     });
	 *
	 *     // Disable restriction on a child state (does that make sense?)
	 *     $state.state('restrictedState.unrestrictedChild', {
	 *         data: {
	 *             restricted: false
	 *         }
	 *     });
	 */
	.config(function($stateProvider) {
		$stateProvider.state('ia-restricted', {
			'abstract': true,
			template: '<ui-view layout-fill>',
			resolve: {
				auth: ['iaAuth', function(iaAuth) {
					return iaAuth.resolve();
				}]
			},
			data: {
				restricted: true,
				roles: []
			}
		});
	})
	// state redirections
	.run(function($rootScope, $state, iaAuth) {
		var events = iaAuth.events,
			config = iaAuth.config();

		// forget return state on any state change
		$rootScope.$on('$stateChangeStart', function() {
			iaAuth.returnToState = iaAuth.returnToStateParams = null;
		});

		// redirect to login or forbidden when trying to access an unauthorized state
		$rootScope.$on('$stateChangeError', function (event, toState, toParams, fromState, fromParams, error) {
			var config = iaAuth.config();

			if (error && error.module === 'ia.auth') {
				if (error.type = 'unauthorized') {
					handle(function() {
						var toState = $state.toState,
							toStateParams = $state.toStateParams;
						$state.go(config.loginState, config.loginStateParams)
							.then(function() {
								iaAuth.returnToState = toState;
								iaAuth.returnToStateParams = toStateParams;
							});
					});
				} else if (error.type = 'forbidden') {
					handle(function() {
						$state.go(config.forbiddenState, config.forbiddenStateParams);
					});
				}
			}

			function handle(fn) {
				event.preventDefault();
				error.handled = true;
				fn();
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
