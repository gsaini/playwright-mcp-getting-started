Feature: Counter widget
  A demo counter with Increment and Reset buttons. The current value
  shows in a [data-testid="counter"] element.

  Group: counter
  Exports: counterScenarios(mcp)

  Background
    The counter starts at 0.

  Scenario: clicking Increment three times raises the value to 3
    Three clicks of the Increment button should leave the counter
    reading "3".

  Scenario: clicking Reset returns the value to 0
    After reset, the counter should read "0".
