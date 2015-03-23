# ia.auth

Simple auth module for [ui.router](http://angular-ui.github.io/ui-router/site/#/api/ui.router).


## Usage

    angular.module('myApp', [
        'ia.auth'
    ]);


## Module configuration

See example bellow for usage and default values:

    module.config(function(iaAuthProvider) {
        iaAuthProvider.config({
            indexState: 'index',
            loginState: 'login',
            forbiddenState: 'forbidden'
        });
    });


## Session, auth data & user data

We distinguish between auth data, and user data. Auth data pertains to authentication
business only; for example, it would contain access token in oauth. User data contains
application specific data about the authenticated user.

Auth data has to be persisted on the client side for authentication to survive a browser
reload. User data may or may not be persisted on the client side, depending of the usage.

Auth data is obtained after a successful login, and is revalidated (expiration, security,
etc.) by the auth adapter each time the page is reloaded.

User data are obtained independantly from auth data. Valid auth data and currently stored
user data are provided to the auth adapter, that can them return what it want.

User data is what is published to the rest of the application, through the $rootScope.


Access Control
--------------

Access control can be exerted at multiple levels.

But don't forget that the user will have the whole code of the javascript client
application in their browser. That means that if they really want to, they will always
be able to hack their way to the hidden features. They're really just that, hidden.

### Restrict state access

Use `data.restricted = true` on the target state to restrict it to authenticated
users (unauthenticated users will be redirected to the login page).

Use `data.roles` array to restrict a state to some given roles. Authenticated users
that don't have one the needed roles will be redirected to the 'forbidden' state
(see config, above). Unauthenticated users that tries to access the state will be
redirected to the login page -- and they successfully authenticate but don't have one
of the required role, they will subsequently be redirected to the 'forbidden' state.

Examples:

    // State will be restricted to authenticated users (any roles)
    $state.state('restrictedState', {
        data: {
            restricted: true
        }
    });

    // Restrict to some roles
    $state.state('restrictedState.child', {
        data: {
            roles: ['user', 'admin']
        }
    });

    // Disable restriction on a child state (does that make sense?)
    $state.state('restrictedState.unrestrictedChild', {
        data: {
            restricted: false
        }
    });


Errors
------

This modules uses error typing in order to know how to handle errors come back from
adapters & such. Error types are exposed in the constant `iaAuthERROR`.

Producing a typed error can be done with any of the following ways:

	var type = iaAuthERROR.myErrorType;
	
	throw type; // as string
	throw new Error(type); // as Error
	throw new {type: type}; // as Object
	
	// form a promise:
	$q.reject(type);
	$q.reject({type: type});
	$q.reject(new Error(type));

The `iaAuthERROR.is()` method can be used to test whether an error will be considered
of a given type by this module.

Example:

	var type = iaAuthERROR.myErrorType,
		otherType = iaAuthERROR.otherType;
	
	iaAuthERROR.is(type, type); // true
	iaAuthERROR.is(type, otherType); // false
	iaAuthERROR.is(undefined, type); // false
	iaAuthERROR.is(new Error(type), type); // true
	iaAuthERROR.is({type: type}, type); // true
