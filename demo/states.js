angular.module('ia.auth')
	.config(function($stateProvider, $urlMatcherFactoryProvider, iaAuthProvider) {

		iaAuthProvider.config({
			indexState: 'app.index',
			loginState: 'login',
			forbiddenState: 'forbidden'
		});

		$urlMatcherFactoryProvider.strictMode(false);

		$stateProvider
			// login view
			.state('login', {
				templateUrl: 'demo/login.html',
				controller: function($scope, iaAuth) {
					$scope.login = function() {
						return iaAuth.login($scope.credentials);
					};
					$scope.logout = iaAuth.login.bind(iaAuth);
				}
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
				url: '',
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
			.state('res', {
				url: '^/res',
				template: '<h1>Restricted</h1>',
				parent: 'ia-restricted'
			})
		;
	})
;
