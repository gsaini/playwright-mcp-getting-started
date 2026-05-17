Feature: Counter widget
  A tiny demo widget with an "Increment" button, a "Reset" button, and a
  visible counter value. Used here only to demonstrate the .feature → .mjs
  compilation pattern — there is no Counter in the real Nimbus Gear app.

  Group: counter
  Imports needed:
    harness: group, scenario, assertEqual
    helpers: clickByRole, evaluate, waitForRender

  Scenario: clicking Increment three times raises the value to 3
    When I click the "Increment" button three times
    And I wait for React to render
    Then evaluating "document.querySelector('[data-testid=counter]').textContent"
    should equal "3"

  Scenario: clicking Reset returns the value to 0
    When I click the "Reset" button
    And I wait for React to render
    Then evaluating "document.querySelector('[data-testid=counter]').textContent"
    should equal "0"
