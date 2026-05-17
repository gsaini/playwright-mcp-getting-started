Feature: Visual snapshots
  Capture full-page PNGs at three points in the flow. There's no DOM-level
  assertion — these artefacts are for humans (or for diffing against a
  baseline if that's wired up later).

  Group: visual
  Function signature: (mcp, APP_URL, SHOTS_DIR)
  Extra import: { join } from "node:path"

  Scenario: catalogue in light theme
    When I navigate to APP_URL
    And I click the radio "Light theme"
    And I wait for the text "Catalogue" to appear
    Then I capture a screenshot at join(SHOTS_DIR, "catalog-light.png")

  Scenario: catalogue in dark theme
    When I click the radio "Dark theme"
    And I yield one animation frame
      (await evaluate(mcp, () => new Promise(r => requestAnimationFrame(r))))
      to let the color transition settle
    Then I capture a screenshot at join(SHOTS_DIR, "catalog-dark.png")

  Scenario: product detail page
    When I click the "Luna Studio Headphones" link
    And I wait for the text "planar-magnetic" to appear
    Then I capture a screenshot at join(SHOTS_DIR, "product-detail.png")
