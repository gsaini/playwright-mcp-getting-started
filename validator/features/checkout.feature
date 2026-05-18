Feature: Checkout
  Multi-field form with inline validation (name, email, shipping address,
  16-digit card number, MM/YY expiry, 3-digit CVV). Submission leaves the
  user on a success page with a generated "NMB-XXXX-XXXX" order number.

  Group: checkout
  Exports: checkoutScenarios(mcp)

  Background
    The cart scenarios left the browser on /checkout with one Aurora
    Wireless Headphones line in the cart.

  Scenario: submitting an empty form surfaces every required-field error
    Clicking the submit button with no fields filled in should produce
    an inline error for every required field on the form.

  Scenario: an invalid email format yields a format-specific error
    Filling every other field correctly but giving an unparseable email
    should produce only the email-format error.

  Scenario: a valid submission redirects to the success page
    Fixing the email and submitting should land the user on the
    success page with order confirmation text.

  Scenario: the success page shows a Nimbus-formatted order number
    The order number on the success page should match the pattern
    NMB-XXXX-XXXX where X is uppercase alphanumeric.

  Scenario: the cart is empty after a successful order
    After the order completes, the header cart badge should be hidden.
