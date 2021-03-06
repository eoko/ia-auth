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
				url: '/login',
				templateUrl: 'example/login.html',
				controller: function($scope, iaAuth) {
					$scope.login = function() {
						return iaAuth.login($scope.credentials);
					};
				}
			})
			.state('forbidden', {
				url: '/forbidden',
				template: '<h1>Forbidden</h1>'
			})
			// base for restricted views
			.state('app', {
				'abstract': true,
				template: '<ui-view></ui-view>',
				data: {
					restricted: true
				}
			})
			// restricted view
			.state('app.index', {
				url: '',
				template: '<h1>Index</h1>'
					+ '<div>Hello {{user}}!</div>',
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
			// restricted to authenticated users (by parent 'app')
			.state('res', {
				parent: 'app',
				url: '^/res',
				template: '<h1>Restricted</h1>'
			})
			// restricted to "dumb" role
			.state('role-yes', {
				url: '^/role-yes',
				template: '<h1>Restricted by role (authorized for {{user.username}})</h1>',
				data: {
					restricted: true,
					roles: ['dumb']
				}
			})
			.state('role-no', {
				url: '^/role-no',
				template: '<h1>Restricted by role (forbidden for {{user.username}})</h2>',
				data: {
					restricted: true,
					roles: ['dumber']
				}
			})
		;
	})
;
