'use strict';

angular.module('ia.auth')
	.service('iaAuthSession', function($q) {
		var key = 'iasperApp.session';

		this.create = function(data) {
			localStorage.setItem(key, JSON.stringify(data));
			return $q.when(true);
		};

		this.destroy = function() {
			localStorage.removeItem(key);
			return $q.when(true);
		};

		this.data = function() {
			try {
				return JSON.parse(localStorage.getItem(key));
			} catch (e) {
				return null;
			}
		};
	})
;
