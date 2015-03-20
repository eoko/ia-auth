'use strict';

angular.module('ia.auth')
	.service('iaAuthSession', function($q) {
		var key = 'iasperApp.session';

		try {
			this._data = JSON.parse(localStorage.getItem(key));
		} catch (e) {
			this._data = null;
		}

		this.create = function(data) {
			data = data || {};
			this._data = data;
			localStorage.setItem(key, JSON.stringify(data));
		};

		this.destroy = function() {
			delete this._data;
			localStorage.removeItem(key);
			return $q.when(true);
		};

		this.data = function() {
			return this._data;
		};
	})
;
