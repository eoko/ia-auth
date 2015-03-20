angular.module('iasperAuthDemo', [
	'ia.auth'
])
	.run(function($rootScope, ia_AUTH_EVENT) {
		$rootScope.$on('$stateChangeError', function (event, toState, toParams, fromState, fromParams, error) {
			if (!error || !error.handled) {
				throw error;
			}
		});

		$rootScope.$on(ia_AUTH_EVENT.login, function(data) {
			debugger
			$rootScope.user = data;
		});
	})
;
