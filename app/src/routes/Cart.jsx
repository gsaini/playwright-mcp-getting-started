/**
 * @file Cart route — line-item table with quantity steppers, remove buttons,
 * subtotal / shipping / total breakdown, and a checkout CTA. Empty state
 * deep-links back to the catalog.
 */

import { Link, useNavigate } from "react-router-dom";

import { useCart } from "../hooks/useCart.jsx";

const SHIPPING = 12;

export default function Cart() {
  const { lines, subtotal, set, remove, clear } = useCart();
  const navigate = useNavigate();

  if (lines.length === 0) {
    return (
      <section className="rounded-(--radius-card) border border-dashed border-border bg-surface-2 p-12 text-center">
        <h1 className="text-2xl font-semibold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted">Browse the catalogue to find something you love.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Continue shopping
        </Link>
      </section>
    );
  }

  const total = subtotal + SHIPPING;

  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-3">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
          <button
            type="button"
            onClick={clear}
            className="text-sm font-medium text-muted hover:text-danger"
          >
            Clear cart
          </button>
        </header>

        <ul data-testid="cart-lines" className="flex flex-col divide-y divide-border">
          {lines.map(({ product, qty, lineTotal }) => (
            <li
              key={product.id}
              data-testid="cart-line"
              data-product-id={product.id}
              className="flex items-center gap-4 py-4"
            >
              <div
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-brand-200 text-2xl dark:from-brand-700/30 dark:to-brand-500/10"
              >
                {product.emoji}
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  to={`/product/${product.id}`}
                  className="block text-sm font-semibold text-fg hover:text-brand-600"
                >
                  {product.name}
                </Link>
                <p className="text-xs text-muted">{product.category}</p>
              </div>

              <div
                className="inline-flex items-center overflow-hidden rounded-full border border-border bg-surface-2"
                role="group"
                aria-label={`Quantity for ${product.name}`}
              >
                <button
                  type="button"
                  aria-label={`Decrease ${product.name}`}
                  onClick={() => set(product.id, qty - 1)}
                  className="px-2.5 py-1 text-fg hover:bg-surface-3"
                >
                  −
                </button>
                <span
                  data-testid="line-qty"
                  className="min-w-[2rem] text-center text-sm font-semibold tabular-nums"
                >
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label={`Increase ${product.name}`}
                  onClick={() => set(product.id, qty + 1)}
                  className="px-2.5 py-1 text-fg hover:bg-surface-3"
                >
                  +
                </button>
              </div>

              <div className="w-20 text-right text-sm font-semibold tabular-nums">${lineTotal}</div>

              <button
                type="button"
                aria-label={`Remove ${product.name}`}
                onClick={() => remove(product.id)}
                className="ml-2 rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      <aside className="h-fit rounded-(--radius-card) border border-border bg-surface-2 p-6">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd data-testid="cart-subtotal" className="font-semibold tabular-nums">
              ${subtotal}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Shipping</dt>
            <dd className="font-semibold tabular-nums">${SHIPPING}</dd>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-base">
            <dt className="font-semibold">Total</dt>
            <dd data-testid="cart-total" className="text-xl font-semibold tabular-nums">
              ${total}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => navigate("/checkout")}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Checkout
        </button>
      </aside>
    </section>
  );
}
