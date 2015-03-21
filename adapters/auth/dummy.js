'use strict';

angular.module('ia.auth')
	.factory('iaAuthAdapter.Dummy', function($timeout, $q, iaAuthHelper) {
		return {
			login: function(credentials) {
				return $q.when({
					username: 'dummy'
				});
			},
			logout: function() {
				return $q.when(true);
			},
			isSameAuth: function(userData1, userData2) {
				if (userData1) {
					if (userData2) {
						return userData1.id === userData2.id
							&& iaAuthHelper.areSameRoles(userData1.roles, userData2.roles);
					} else {
						return false;
					}
				} else if (userData2) {
					return false;
				} else {
					// !userData1 && !userData2 => same "no identity"
					return true;
				}
			}
		};
	})
;
