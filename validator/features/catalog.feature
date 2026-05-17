Feature: Product catalogue
  Search, category filter, sort, inventory edge cases, and navigation to
  detail pages. After every state-changing user action we wait on the
  "Showing N of 8" indicator at the top of the grid — it's the cleanest
  "React has settled" signal.

  Group: catalog
  Function signature: (mcp)

  Scenario: shows every product on first load
    Then I wait for the text "Showing 8 of 8" to appear
    And the number of [data-testid="product-card"] elements should equal 8

  Scenario: filters by category pill (Audio → 3 products)
    When I click the "Audio" button
    And I wait for the text "Showing 3 of 8" to appear
    Then the visible product names — collected from
      [data-testid="product-card"] h3 a — should equal:
        ["Aurora Wireless Headphones", "Luna Studio Headphones", "Nova Desktop Speakers"]

  Scenario: clearing the category filter restores all products
    When I click the "All" button
    And I wait for the text "Showing 8 of 8" to appear
    Then the [data-testid="product-card"] count should equal 8

  Scenario: searching narrows the result set by name
    When I type "wireless" into "#catalog-search" via typeSelector
      (description "search input")
    And I wait for the text "Showing 2 of 8" to appear
    Then the visible product names should equal:
      ["Aurora Wireless Headphones", "Vega Wireless Mouse"]

  Scenario: a no-match search shows the empty state
    When I replace the search input value with "kjasdf" via setReactInputValue
      on "#catalog-search" (typing would append to the existing query)
    And I wait for the text "No matches" to appear
    Then a [data-testid="empty-results"] element must exist
    Use assert(...) for the existence check.

  Scenario: clearing the search restores all products
    When I clear "#catalog-search" via setReactInputValue with value ""
    Then I wait for the text "Showing 8 of 8" to appear

  Scenario: sorting by price ascending orders products cheapest-first
    When I set "#catalog-sort" to "price-asc" via setReactInputValue
      with eventType "change"
    And I wait one render via waitForRender
    Then the list of prices parsed from [data-testid="product-price"]
      (strip "$", Number()) should equal its own ascending-sorted copy

  Scenario: the out-of-stock product carries a visible badge
    Then at least one [data-testid="product-card"] must contain the text
      "Out of stock". Use evaluate + Array.from(...).some(...).

  Scenario: clicking a product card opens its detail page
    When I click the "Aurora Wireless Headphones" link
    And I wait for the text "Quantity" to appear
      (do not wait for "30-hour battery" — that appears on the catalog too)
    Then the current URL should end with "/product/headphones-aurora"
