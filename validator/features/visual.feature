Feature: Visual snapshots
  Capture full-page PNGs of the catalogue in both themes and one product
  detail page. There are no DOM-level assertions — the artefacts are for
  humans (or for diffing against a baseline if that's wired up later).

  Group: visual
  Exports: visualScenarios(mcp, APP_URL, SHOTS_DIR)

  Background
    Navigate to APP_URL fresh. The user is still signed in from the auth
    scenarios — no need to re-authenticate.

  Scenario: capture the catalogue in light theme
    Switch to Light, wait for the catalogue heading, capture a screenshot
    as catalog-light.png in SHOTS_DIR.

  Scenario: capture the catalogue in dark theme
    Switch to Dark (let the color transition settle for one animation frame)
    and capture as catalog-dark.png in SHOTS_DIR.

  Scenario: capture a product detail page
    Open Luna Studio Headphones from the catalogue and capture the detail
    page as product-detail.png in SHOTS_DIR.
