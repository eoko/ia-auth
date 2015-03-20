'use strict';

angular.module('ia.auth')
	.config(function($stateProvider) {
		$stateProvider.state('ia-restricted', {
			'abstract': true,
			template: '<ui-view>',
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
;
