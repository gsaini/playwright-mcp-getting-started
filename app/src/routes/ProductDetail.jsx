/**
 * @file Product detail route — gallery panel, summary, quantity stepper,
 * "Add to cart" button, "Buy now" shortcut. Renders a 404-ish empty state
 * if the id in the URL doesn't match a product.
 */

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getProduct } from "../data/products.js";
import { useCart } from "../hooks/useCart.jsx";

export default function ProductDetail() {
  const { id } = useParams();
  const product = getProduct(id);
  const { add } = useCart();
  const navigate = useNavigate();

  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  if (!product) {
    return (
      <section className="rounded-(--radius-card) border border-dashed border-border bg-surface-2 p-10 text-center">
        <h1 className="text-2xl font-semibold">Product not found</h1>
        <p className="mt-2 text-sm text-muted">
          The product you're looking for doesn't exist (yet).
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          ← Back to catalogue
        </Link>
      </section>
    );
  }

  const inStock = product.stock > 0;
  const maxQty = Math.min(product.stock, 10);

  function handleAdd() {
    add(product.id, qty);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  }

  function handleBuyNow() {
    add(product.id, qty);
    navigate("/cart");
  }

  return (
    <article aria-labelledby="product-heading" className="grid gap-10 lg:grid-cols-2">
      <div
        aria-hidden="true"
        className="flex aspect-square items-center justify-center rounded-(--radius-card) bg-gradient-to-br from-brand-50 to-brand-200 text-[10rem] dark:from-brand-700/30 dark:to-brand-500/10"
      >
        {product.emoji}
      </div>

      <div className="flex flex-col gap-4">
        <Link to="/" className="text-sm text-muted hover:text-fg">
          ← Catalogue
        </Link>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted">
            {product.category}
          </span>
          <span className="text-xs text-muted">★ {product.rating.toFixed(1)}</span>
        </div>

        <h1 id="product-heading" className="text-3xl font-semibold tracking-tight">
          {product.name}
        </h1>
        <p data-testid="product-price-detail" className="text-3xl font-semibold text-fg">
          ${product.price}
        </p>
        <p className="text-base leading-relaxed text-muted">{product.summary}</p>

        {inStock ? (
          <p className="text-sm text-success">In stock — {product.stock} available</p>
        ) : (
          <p className="text-sm text-danger">Out of stock</p>
        )}

        <div className="mt-2 flex items-center gap-3">
          <label className="text-sm font-medium text-muted">Quantity</label>
          <div
            className="inline-flex items-center overflow-hidden rounded-full border border-border bg-surface-2"
            role="group"
            aria-label="Quantity selector"
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={qty <= 1 || !inStock}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="px-3 py-1.5 text-fg hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <span
              aria-live="polite"
              data-testid="quantity-value"
              className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums"
            >
              {qty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={qty >= maxQty || !inStock}
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              className="px-3 py-1.5 text-fg hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!inStock}
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to cart
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={!inStock}
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface-2 px-5 py-2.5 text-sm font-semibold text-fg hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Buy now
          </button>
        </div>

        {justAdded && (
          <p
            role="status"
            data-testid="add-toast"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-success/15 px-3 py-1.5 text-sm font-medium text-success"
          >
            ✓ Added to cart
          </p>
        )}
      </div>
    </article>
  );
}
