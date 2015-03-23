'use strict';

angular.module('ia.auth')
	.factory('iaAuthAdapter', function($timeout, $q, iaAuthHelper) {
		var sessionKey = 'ia.auth:dummy-auth';
		return {
			/**
			 * Do a login tentative with the provided credentials.
			 *
			 * Must return **auth data** (that is, access token, etc.).
			 *
			 * If the tentative is successful, the promise must be resolved
			 * with the auth data; else it must be rejected with a type
			 * of `iaAuth_ERROR.invalidCredentials` (see: Errors).
			 *
			 * @param {Object} credentials
			 * @returns {$q.Promise}
			 */
			login: function(credentials) {
				return $timeout(function() {
					return true;
				}, 300);
			},
			logout: function() {
				return $q.when(true);
			},
			/**
			 * Called to validate auth data that has been retrieved from session.
			 *
			 * The method is only called if the auth data have been retrieved from
			 * client side session, not after a successful login.
			 *
			 * The passed data object is the one that has been initially returned
			 * by this adapter's {@link #login} method; or the one that has been
			 * returned by this very method.
			 *
			 * Must return a promise that resolve to an authData object, whether
			 * the same that was passed or another.
			 *
			 * If the auth data isn't valid (e.g. expired), the promise must resolve
			 * to null or be rejected with a type of `iaAuth_ERROR.invalidAuthData`.
			 *
			 *     $q.reject({
			 *         type: iaAuth_ERROR.invalidAuthData
			 *     });
			 *
			 *     or:
			 *
			 *     $q.reject(iaAuth_ERROR.invalidAuthData)
			 *
			 *     or:
			 *
			 *     throw new Error(iaAuth_ERROR.invalidAuthData)
			 *
			 * @param {Object/null} authData
			 * @returns {$q.Promise}
			 */
			validateAuthData: function(authData) {
				return $q.when(authData);
			},
			/**
			 * Resolve user data (that is, the data that will be exposed to other
			 * application's compoments), once the user has been authenticated
			 * (that is, auth data is known & valid).
			 *
			 * The first argument is the auth data, as provided by the {@link #login}
			 * or {@link #validateAuthData} of this adapter. It will always been
			 * provided and has just been validated by {@link #validateAuthData}.
			 *
			 * The second argument is the user data that have been stored in session.
			 * Its presence depends on the session adapter implementation. In case
			 * where it is present, it is expected to be validated (i.e. ensure it is
			 * still current) by this method.
			 *
			 * @param {Object} authData
			 * @param {Object/null} sessionUserData
			 * @returns {$q.Promise}
			 */
			resolveUserData: function(authData, sessionUserData) {
				return $timeout(function() {
					return {
						username: 'dummy',
						roles: ['dumb']
					};
				}, 300);
			},
			parseRoles: function(userData) {
				return userData && userData.roles;
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
