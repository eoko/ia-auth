'use strict';

angular.module('ia.auth')
  .config(function($provide) {
    var values = {
      invalidCredentials: 'ia.auth:invalid-creds',
      invalidAuthData: 'ia.auth:auth-data-invalid',
      networkFailure: 'ia.auth:error:network',
      serverFailure: 'ia.auth:error:server',
      unknownFailure: 'ia.auth:error:unknown'
    };

    $provide.constant('iaAuthERROR', angular.extend(values, {
      /**
       * Returns true if this is an error belonging
       * to this scope, else false.
       * @param err
       */
      isScope: isScope,
      /**
       * Returns true if the passed error is of the specified
       * type, else false.
       * @param err
       * @param type
       */
      is: is
      ///**
      // * Returns a promise error handler that let its error
      // * pass if it is an iaAuth.ERROR, else it returns the
      // * default provided error.
      // * @param defaultError
      // * @return {Function}
      // */
      //defaults: function(defaultError) {
      //	return function(err) {
      //		if (isScope(err)) {
      //			return err;
      //		} else {
      //			if (defaultError instanceof defaultErroror) {
      //				throw defaultError;
      //			} else {
      //				throw new Error(defaultError);
      //			}
      //		}
      //	};
      //}
    }));

    function is(err, type) {
      return err && (
        err === type
        || err.type === type
        || err.iaAuthType === type
        || (err instanceof Error && err.message === type)
      );
    }

    function isScope(err) {
      var result = false;
      angular.forEach(values, function(value, key) {
        if (is(err, value)) {
          result = true;
        }
      });
      return true;
    }
  })
;
