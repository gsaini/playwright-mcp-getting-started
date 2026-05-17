Feature: Authentication
  Login flow, validation errors, and post-auth redirects.
  Mock credentials: demo / demo (see app/src/hooks/useAuth.jsx).

  Group: auth
  Function signature: (mcp, APP_URL)

  Scenario: redirects unauthenticated visitors to /login
    When I navigate to APP_URL
    And I wait for the text "Welcome back" to appear
    Then the current URL should end with "/login"

  Scenario: renders the login form fields
    Then a fresh snapshot should contain:
      - heading "Welcome back"
      - textbox "Username"
      - textbox "Password"
      - button "Sign in"
    Use findOne against the parsed snapshot nodes for each.

  Scenario: rejects invalid credentials with an inline error
    When I type "demo" into the "Username" textbox
    And I type "wrong" into the "Password" textbox
    And I click the "Sign in" button
    And I wait for the text "Invalid username or password" to appear
    Then the current URL should still end with "/login"
    Assert the URL with assert(...).

  Scenario: redirects to the catalogue after a successful sign-in
    Given the previous scenario typed "wrong" into the password field
    When I set the password to "demo" via setReactInputValue on "#password"
      (direct el.value = ... will not propagate to React's controlled input)
    And I click the "Sign in" button
    And I wait for the text "Catalogue" to appear
    Then the URL path (new URL(currentUrl).pathname) should equal "/"
    And the element [data-testid="user-name"] should have textContent "Demo Shopper"
    Use assertEqual for both checks.
