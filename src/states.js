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
			} else if (iaAuth.helper.isStateRestricted(toState)
					|| toState.name === config.indexState && config.restrictedIndex) {
				if (iaAuth.isResolved()) {
					if (toState.name === config.indexState && config.restrictedIndex
							&& iaAuth.isAuthorizedState(config.restrictedIndex)) {
						event.preventDefault();
						$state.go(config.restrictedIndex, config.restrictedIndexParams);
					} else if (!iaAuth.isAuthorizedState(toState)) {
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
					if (config.redirectOnChange) { // TODO redirectOnChange cannot really be optional anymore...
						iaAuth.returnToState = toState;
						iaAuth.returnToStateParams = toParams;
						iaAuth.resolveIdentity();
					} else {
						iaAuth.resolveIdentity(function() {
							// retry our state transition. this time, we'll pass in the resolved logic
							$state.go(toState, toParams);
						});
					}
				}
			}
		});

		$rootScope.$on(events.change, function(userData, previousUserData) {
			// TODO This has become *very* messy... Should really separate
			//      state change event (may happens several times) from state
			//      resolved (happens only once)
			//
			// redirect to return or index page on login (or resolve auth),
			// and index, return, or forbidden page on logout (or resolve no auth)
			if (config.redirectOnChange) {
				var redirected;
				if (iaAuth.isAuthenticated()) {
					redirected = redirect([
						[iaAuth.returnToState, iaAuth.returnToStateParams],
						[config.restrictedIndex, config.restrictedIndexParams],
						[config.indexState, config.indexStateParams],
						[config.loginState, config.loginStateParams]
					]);
				}
				if (!redirected) {
					if (iaAuth.returnToState && !previousUserData) {
						// we're not authenticated, but we want to go to an auth state, so login
						redirect([
							[iaAuth.returnToState, iaAuth.returnToStateParams], // in case state is open
							[config.loginState, config.loginStateParams],
							[config.indexState, config.indexStateParams]
						]);
					} else {
						// we're not authenticated
						if (!iaAuth.isAuthorizedState($state.$current)) {
							redirect([
								[config.indexState, config.indexStateParams],
								[iaAuth.returnToState, iaAuth.returnToStateParams],
								[config.loginState, config.loginStateParams]
							]);
						}
					}
				}
				// reset returnToState
				iaAuth.returnToState = iaAuth.returnToStateParams = null;
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
