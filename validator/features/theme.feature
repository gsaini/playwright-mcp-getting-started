Feature: Theme toggle
  Three-way theme picker in the header — Light, System, Dark. The
  preference is persisted to localStorage. Dark mode toggles a `dark`
  class on the <html> element.

  Group: theme
  Exports: themeScenarios(mcp)

  Background
    The checkout scenarios left the browser on /checkout/success. The
    theme picker is reachable from the header on any signed-in screen.

  Scenario: selecting Light removes the dark class from <html>
    Picking the Light option in the theme picker should leave the page
    without the `.dark` class on the root element.

  Scenario: selecting Dark adds the dark class to <html>
    Picking the Dark option should put `.dark` on the root element.

  Scenario: the preference persists to localStorage
    After picking Dark, localStorage["nimbus.theme"] should equal "dark".

  Scenario: selecting System defers to the OS preference
    Picking System should set localStorage["nimbus.theme"] to "system".
    The System option in the radio group should report as checked.
    Do not assert on the .dark class — that depends on the host OS.
