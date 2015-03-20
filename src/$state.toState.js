'use strict';

angular.module('ia.auth')
	.config(function($provide) {
		$provide.decorator('$state', function($delegate, $rootScope) {
			$rootScope.$on('$stateChangeStart', function(event, state, params) {
				$delegate.toState = state;
				$delegate.toStateParams = params;
			});
			return $delegate;
		})
	})
;
