Feature: Product catalogue
  After login the user lands on a paginated grid of products with search,
  category filters, sort, and an "out of stock" indicator. Eight products
  total in three categories (Audio, Input, Display, Video, Accessories).

  Group: catalog
  Exports: catalogScenarios(mcp)

  Background
    The auth scenarios left the browser on "/", signed in as demo.

  Scenario: every product is visible on first load
    All eight products should render as cards in a single grid.

  Scenario: filtering to a category narrows the grid
    Clicking the Audio category pill should reduce the grid to the three
    audio products only. The names should match exactly.

  Scenario: clearing the filter restores the full catalogue
    Clicking the "All" pill should return the grid to all eight products.

  Scenario: search filters by product name
    Searching for "wireless" should narrow the grid to just the two
    products with that word in the name.

  Scenario: a search with no matches shows an empty state
    Typing nonsense like "kjasdf" should show an empty-state panel
    instead of a product grid.

  Scenario: clearing the search restores the full catalogue
    Emptying the search input should return the grid to all eight items.

  Scenario: sorting by price ascending orders products cheapest first
    With the sort dropdown set to "Price: low to high", the visible prices
    should be in non-decreasing order.

  Scenario: out-of-stock products carry a visible badge
    One of the eight products is out of stock and should be marked as
    such on its card.

  Scenario: clicking a product card opens its detail page
    Clicking the Aurora Wireless Headphones link should navigate to that
    product's detail page.
