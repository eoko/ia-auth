'use strict';

angular.module('ia.auth')
	.service('iaAuthAdapter', function($timeout, $q) {
		this.login = function(credentials) {
			return getUserData(credentials);
		};
		this.logout = function() {
			return $q.when(true);
		};
		function getUserData() {
			return $q.when({
				username: 'dummy'
			});
		};
	})
;
