'use strict';

angular.module('ia.auth')
	.service('iaAuthSession', function($q) {
		var storage = window.localStorage,
			authKey = 'ia.auth:auth',
			dataKey = 'ia.auth:data';

		if (!storage) {
			throw new Error('Local storage is not supported by this platform.');
		}

		/**
		 * Write or read auth data.
		 *
		 * For writting, this method MUST persist the data on the client side in
		 * order for persistent login (i.e. that survives page refresh) to be
		 * possible.
		 *
		 * When this data is retrieved from session, it will be validated by the
		 * auth adapter, to ensure it has not expired.
		 *
		 * @param authData
		 * @returns {$q.Promise}
		 */
		this.authData = function(authData) {
			if (arguments.length) {
				return write(authKey, authData);
			} else {
				return read(authKey);
			}
		};

		/**
		 * Write or read user data.
		 *
		 * This method may or may not persist this data on the client side. If the
		 * data is not persisted, it will have to be loaded after each refresh of
		 * the application. If it is persisted, it will be needed to take further
		 * validation steps to ensure it is still current -- that will happen in
		 * the adapter's `resolveUserData` method.
		 *
		 * @param userData
		 * @returns {$q.Promise}
		 */
		this.userData = function(userData) {
			if (arguments.length) {
				return write(dataKey, userData);
			} else {
				return read(dataKey);
			}
		};

		this.clear = function() {
			return $q.all([
				destroy(authKey),
				destroy(dataKey)
			]);
		};

		//this.create = function(data) {
		//	localStorage.setItem(authKey, JSON.stringify(data));
		//	return $q.when(true);
		//};
		//
		//this.destroy = function() {
		//	destroy(authKey);
		//	destroy(dataKey);
		//	return $q.when(true);
		//};
		//
		//this.data = function() {
		//	try {
		//		return JSON.parse(localStorage.getItem(authKey));
		//	} catch (e) {
		//		return null;
		//	}
		//};

		function write(key, data) {
			storage.setItem(key, JSON.stringify(data));
			return $q.when(true);
		}

		function read(key) {
			var json = storage.getItem(key);
			if (json != null) {
				return $q.when(JSON.parse(json));
			} else {
				return $q.when(null);
			}
		}

		function destroy(key) {
			storage.removeItem(key);
			return $q.when(true);
		}
	})
;
