'use strict';

angular.module('ia.auth')
	.constant('iaAuthHelper', {
		areSameRoles: function areSameRoles(roles1, roles2) {
			if (roles1 === roles2) {
				return true;
			} else if (!roles1 && !roles2) {
				return true;
			} else if (roles1.length === roles2.length) {
				return roles1.every(function(role) {
					return roles2.indexOf(role) !== -1;
				});
			} else {
				return false;
			}
		}
	})
;
