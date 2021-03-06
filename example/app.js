angular.module('iasperAuthDemo', [
	'ia.auth'
])
	.run(function($rootScope, iaAuth) {
		$rootScope.logout = iaAuth.logout.bind(iaAuth);
	})
	.run(function($rootScope, ia_AUTH_EVENT) {
		$rootScope.$on('$stateChangeError', function (event, toState, toParams, fromState, fromParams, error) {
			if (!error || !error.handled) {
				throw error;
			}
		});
	})
;
