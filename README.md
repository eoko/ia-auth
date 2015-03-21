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

## Access Control

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
        parent: 'ia-restricted'
    });

    // Restrict to some roles
    $state.state('ia-restricted.restrictedState', {
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
