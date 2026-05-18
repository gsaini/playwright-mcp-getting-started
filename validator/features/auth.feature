Feature: Authentication
  The app uses mock credentials (username "demo", password "demo"). A
  successful sign-in redirects to the catalogue at "/". An unauthenticated
  visitor is bounced to "/login".

  Group: auth
  Exports: authScenarios(mcp, APP_URL)

  Background
    Start at APP_URL with no prior session.

  Scenario: unauthenticated visitors land on the login screen
    Hitting the home page when signed out should leave the browser
    sitting on the login route.

  Scenario: the login form renders the expected fields
    The login screen should expose a username textbox, a password textbox,
    and a submit button — addressable by accessible name.

  Scenario: invalid credentials yield an inline error
    Submitting wrong credentials should surface an inline error and keep
    the visitor on /login.

  Scenario: valid credentials redirect to the catalogue
    Submitting "demo / demo" should put the user on the catalogue and
    show their display name somewhere in the header chrome.
