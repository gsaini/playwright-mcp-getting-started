/**
 * @file Catalog route — search box, category pills, sort dropdown, results
 * grid. All filters compose: results = products filtered by query AND
 * category, then sorted by the active sort key.
 */

import { useMemo, useState } from "react";

import ProductCard from "../components/ProductCard.jsx";
import { categories, products } from "../data/products.js";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

export default function Catalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [query, category, sort]);

  return (
    <section aria-labelledby="catalog-heading" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 id="catalog-heading" className="text-3xl font-semibold tracking-tight">
          Catalogue
        </h1>
        <p className="text-sm text-muted">
          Hand-picked gear for desk-bound humans. {products.length} items.
        </p>
      </header>

      {/* Filters bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <label className="flex-1">
            <span className="sr-only">Search products</span>
            <input
              id="catalog-search"
              type="search"
              placeholder="Search products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search products"
              className="w-full rounded-full border border-border bg-surface-2 px-4 py-2.5 text-sm text-fg placeholder:text-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Sort</span>
            <select
              id="catalog-sort"
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-full border border-border bg-surface-2 px-3 py-2 text-sm text-fg focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
          {["All", ...categories].map((c) => {
            const active = category === c;
            return (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-border bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg"
                }`}
              >
                {c}
              </button>
            );
          })}
        </nav>
      </div>

      <p data-testid="result-count" className="text-sm text-muted">
        Showing <strong className="text-fg">{visible.length}</strong> of {products.length} product
        {products.length === 1 ? "" : "s"}
      </p>

      {visible.length > 0 ? (
        <ul
          data-testid="product-grid"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((p) => (
            <li key={p.id} className="relative">
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      ) : (
        <div
          data-testid="empty-results"
          className="rounded-(--radius-card) border border-dashed border-border bg-surface-2 p-12 text-center"
        >
          <p className="text-lg font-medium text-fg">No matches</p>
          <p className="mt-1 text-sm text-muted">
            Try a different keyword or clear the category filter.
          </p>
        </div>
      )}
    </section>
  );
}
