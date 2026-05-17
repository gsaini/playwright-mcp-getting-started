Feature: Checkout
  Form validation surfaces every field error, happy path lands on the
  success page with a Nimbus-formatted order number. Starts on /checkout
  with one Aurora headphones line item.

  Group: checkout
  Function signature: (mcp)

  Helpers:
    - readErrors(mcp) → evaluate that returns the text of every
      [role="alert"] element on the page, trimmed.

  Scenario: submitting an empty form surfaces every required-field error
    When I click the "Place order" button
    And I wait for the text "Name is required" to appear
    Then readErrors(mcp).sort() should equal:
      [
        "CVV must be 3 digits",
        "Card number must be 16 digits",
        "Email is required",
        "Expiry must be MM/YY",
        "Name is required",
        "Shipping address is required",
      ]

  Scenario: an invalid email yields a format-specific error
    When I typeSelector the following into the indicated fields:
      "#field-fullName" ← "Demo Shopper"
      "#field-email"    ← "not-an-email"
      "#field-address"  ← "123 Cloud St"
      "#field-card"     ← "4242424242424242"
      "#field-expiry"   ← "12/29"
      "#field-cvv"      ← "123"
    And I click the "Place order" button
    And I wait for the text "Enter a valid email address" to appear
    Then readErrors(mcp) should equal ["Enter a valid email address"]

  Scenario: valid form submission completes and redirects
    When I set "#field-email" to "demo@nimbus.gear" via setReactInputValue
    And I click the "Place order" button
    Then I wait for the text "Order placed" to appear
    Note: the transient "Placing order…" label has too short a lifetime
    to assert on reliably through a remote driver — do not wait for it.

  Scenario: success page shows a Nimbus-formatted order number
    Then the current URL should end with "/checkout/success"
    And the textContent of [data-testid="order-number"] must exist
    Assert it contains "NMB-" with assertContains.
    Assert it matches /^NMB-[0-9A-Z]{4}-[0-9A-Z]{4}$/ with assert.

  Scenario: cart is empty after a successful order
    Wait one render. Then evaluating
    !!document.querySelector('[data-testid="cart-badge"]') must be false.
