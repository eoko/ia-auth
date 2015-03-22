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
