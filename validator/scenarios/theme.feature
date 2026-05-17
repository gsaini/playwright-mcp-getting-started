Feature: Theme toggle
  Three-way Light / System / Dark picker in the header. Each option is
  rendered as a role="radio" button with aria-label "<Mode> theme".
  Preference is persisted to localStorage["nimbus.theme"].

  Group: theme
  Function signature: (mcp)

  Scenario: light theme removes the .dark class from <html>
    When I click the radio "Light theme"
    And I wait one render via waitForRender
    Then document.documentElement.classList.contains("dark") should equal false

  Scenario: dark theme adds the .dark class to <html>
    When I click the radio "Dark theme"
    And I wait one render
    Then document.documentElement.classList.contains("dark") should equal true

  Scenario: preference persists to localStorage
    Then localStorage.getItem("nimbus.theme") should equal "dark"

  Scenario: system theme defers to the OS preference
    When I click the radio "System theme"
    And I wait one render
    Then localStorage.getItem("nimbus.theme") should equal "system"
    And the radio[aria-label="System theme"] should have ariaChecked === "true"
    Note: don't assert .dark here — that depends on the host OS preference.
    Use assert(...) for the aria-checked check.
