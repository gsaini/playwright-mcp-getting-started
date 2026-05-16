/**
 * @file Product card used in the catalogue grid.
 *
 * Exposes plenty of accessibility hooks (named heading, named link, stock
 * label) so the validator can address each card without DOM querying.
 */

import { Link } from "react-router-dom";

/**
 * @param {{ product: import("../data/products.js").Product }} props
 */
export default function ProductCard({ product }) {
  const inStock = product.stock > 0;
  const lowStock = inStock && product.stock <= 5;

  return (
    <article
      data-testid="product-card"
      data-product-id={product.id}
      className="group flex flex-col overflow-hidden rounded-(--radius-card) border border-border bg-surface-2 transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg"
    >
      <div
        aria-hidden="true"
        className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-brand-50 to-brand-200 text-6xl dark:from-brand-700/30 dark:to-brand-500/10"
      >
        {product.emoji}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
            {product.category}
          </span>
          <span
            role="img"
            aria-label={`Rated ${product.rating} out of 5`}
            className="text-xs text-muted"
          >
            ★ {product.rating.toFixed(1)}
          </span>
        </div>

        <h3 className="text-base font-semibold leading-tight text-fg">
          <Link
            to={`/product/${product.id}`}
            className="after:absolute after:inset-0 after:content-[''] hover:text-brand-600"
          >
            {product.name}
          </Link>
        </h3>

        <p className="line-clamp-2 text-sm text-muted">{product.summary}</p>

        <div className="mt-auto flex items-center justify-between pt-3">
          <span data-testid="product-price" className="text-lg font-semibold text-fg">
            ${product.price}
          </span>
          {inStock ? (
            <span className={`text-xs font-medium ${lowStock ? "text-warning" : "text-success"}`}>
              {lowStock ? `Only ${product.stock} left` : "In stock"}
            </span>
          ) : (
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-danger">
              Out of stock
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
