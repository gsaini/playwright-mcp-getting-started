Feature: Shopping cart
  Add to cart, quantity stepper, multi-product cart, line removal, badge
  sync, totals math, and navigation to checkout. Starts on the Aurora
  Wireless Headphones detail page (carried over from catalog scenarios).
  The cart is empty at the start of each `pnpm demo` run.

  Group: cart
  Function signature: (mcp, APP_URL)

  Scenario: adds a product to the cart and shows a toast
    When I click the "Increase quantity" button
    And I wait one render via waitForRender
    Then evaluating the textContent of [data-testid="quantity-value"]
      should equal "2"
    When I click the "Add to cart" button
    Then I wait for the text "Added to cart" to appear

  Scenario: cart badge updates with the new item count
    Wait one render, then evaluating the textContent of
    [data-testid="cart-badge"] should equal "2".

  Scenario: adding a second product compounds the badge count
    When I click the "Catalog" link
    And I wait for the text "Catalogue" to appear
    And I click the "Polaris Mechanical Keyboard" link
    And I wait for the text "Hot-swappable" to appear
    And I click the "Add to cart" button
    And I wait for the text "Added to cart" to appear
    And I wait one render
    Then evaluating [data-testid="cart-badge"].textContent should equal "3"

  Scenario: cart page lists every line item with correct totals
    When I navigate to `${APP_URL}cart`
    And I wait for the text "Your cart" to appear
    Then collecting each [data-testid="cart-line"]'s
      { id: dataset.productId, qty: Number([data-testid=line-qty].textContent) }
      should equal:
        [
          { id: "headphones-aurora",  qty: 2 },
          { id: "keyboard-polaris",   qty: 1 },
        ]
    And [data-testid="cart-subtotal"].textContent should equal "$547"
      (2 × $199 + 1 × $149)
    And [data-testid="cart-total"].textContent should equal "$559"
      (subtotal $547 + shipping $12)

  Scenario: decreasing a line quantity updates totals
    When I click the decrease button inside the Aurora headphones row
      via clickSelector with selector
      [data-testid="cart-line"][data-product-id="headphones-aurora"]
        button[aria-label^="Decrease"]
      and description "decrease Aurora headphones"
    And I wait for the text "$348" to appear (the new subtotal)
    Then the cart lines should equal:
        [
          { id: "headphones-aurora", qty: 1 },
          { id: "keyboard-polaris",  qty: 1 },
        ]

  Scenario: removing a line drops it from the cart
    When I click the "Remove Polaris Mechanical Keyboard" button
    And I wait one render
    Then collecting each [data-testid="cart-line"]'s dataset.productId
      should equal ["headphones-aurora"]
    And [data-testid="cart-badge"].textContent should equal "1"

  Scenario: checkout CTA navigates to /checkout
    When I click the "Checkout" button
    And I wait for the text "Place order" to appear
    Then the current URL should end with "/checkout"
