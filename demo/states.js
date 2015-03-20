angular.module('ia.auth')
	.config(function($stateProvider) {
		$stateProvider
			// login view
			.state('login', {
				//url: '/login',
				templateUrl: 'demo/login.html'
			})
			.state('forbidden', {
				template: '<h1>Forbidden</h1>'
			})
			// base for restricted views
			.state('app', {
				'abstract': true,
				parent: 'ia-restricted',
				template: '<ui-view></ui-view>'
			})
			// restricted view
			.state('app.index', {
				url: '/',
				template: '<h1>Index</h1>'
					+ '<div>Hello {{user}}!</div>'
					+ '<button ng-click="logout()">Disconnect</button>',
				controller: function($scope, iaAuth) {
					$scope.logout = function() {
						iaAuth.logout();
					};
				}
			})
			// public view
			.state('pub', {
				url: '/pub',
				template: '<h1>Public</h1>'
			})
		;
	})
;
