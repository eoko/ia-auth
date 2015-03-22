'use strict';

angular.module('ia.auth')
	.constant('iaAuthHelper', {
		areSameRoles: function areSameRoles(roles1, roles2) {
			if (roles1 === roles2) {
				return true;
			} else {
				if (roles1) {
					if (roles2 && roles1.length == roles2.length) {
						return roles1.every(function(role) {
							return roles2.indexOf(role) !== -1;
						});
					}
				} else if (!roles2) {
					return true;
				}
			}
			return true;
		},
		/**
		 * Returns true if the given role string is found in the passed roles array.
		 *
		 * If role is null, false, or undefined, then the function will always return true.
		 *
		 * If role has a value, but roles is not an array, then the function will always
		 * return false.
		 *
		 * @param {string[]} requiredRoles
		 * @param {string} testedRoles
		 * @returns {boolean}
		 */
		rolesContains: function(requiredRoles, testedRoles) {
			if (testedRoles === null || testedRoles === undefined || testedRoles === false) {
				return true;
			} else if (angular.isArray(requiredRoles)) {
				if (angular.isArray(testedRoles)) {
					return requiredRoles.some(function(role) {
						return testedRoles.indexOf(role) !== -1;
					});
				} else {
					return angular.isArray(requiredRoles) && requiredRoles.indexOf(testedRoles) !== -1;
				}
			} else {
				throw new Error('Illegal Argument (requiredRoles must be an array or falsy.');
			}
		},
		isStateRestricted: function(state) {
			return state && state.data && state.data.restricted;
		},
		parseStateRoles: function(state) {
			return state && state.data && state.data.roles;
		}
	})
;
