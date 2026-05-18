Feature: Shopping cart
  Detail page → add to cart → review cart → modify quantities → check out.
  The cart icon in the header shows a live badge with the item count.
  Subtotal + flat $12 shipping = total.

  Group: cart
  Exports: cartScenarios(mcp, APP_URL)

  Background
    The catalog scenarios left the browser on the Aurora Wireless
    Headphones detail page. The cart starts empty.

  Scenario: bumping quantity and adding the product shows a confirmation
    Increasing the quantity to 2 and clicking add-to-cart should produce
    a "Added to cart" affordance somewhere on the page.

  Scenario: the cart badge in the header reflects the new count
    After adding qty 2, the badge should read "2".

  Scenario: adding a second product compounds the badge count
    Navigating back to the catalogue, opening Polaris Mechanical Keyboard,
    and adding one to the cart should bump the badge to "3".

  Scenario: the cart page lists every line item with correct totals
    Visiting /cart should list both products with their quantities, a
    subtotal of $547 (2 × $199 + 1 × $149), and a total of $559
    (subtotal + $12 shipping).

  Scenario: decreasing a line quantity recomputes the totals
    Reducing the headphones quantity by one should drop the subtotal
    to $348 and leave both products in the cart at quantity 1.

  Scenario: removing a line drops it from the cart
    Removing the Polaris Mechanical Keyboard line should leave only the
    headphones in the cart and update the badge to "1".

  Scenario: the checkout CTA navigates to /checkout
    The checkout button should land the browser on /checkout.
