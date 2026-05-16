/**
 * @file Top-of-page header — logo, primary nav, cart badge, theme toggle,
 * user menu. Sticky so it stays visible while the catalog scrolls.
 */

import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.jsx";
import { useCart } from "../hooks/useCart.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

export default function Header() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-fg"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"
          >
            N
          </span>
          Nimbus Gear
        </Link>

        {user && (
          <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 sm:flex">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`
              }
            >
              Catalog
            </NavLink>
            <NavLink
              to="/cart"
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`
              }
            >
              Cart
            </NavLink>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />

          {user && (
            <Link
              to="/cart"
              aria-label={`Cart with ${itemCount} item${itemCount === 1 ? "" : "s"}`}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-fg hover:bg-surface-3"
            >
              <span aria-hidden="true">🛒</span>
              {itemCount > 0 && (
                <span
                  data-testid="cart-badge"
                  className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white"
                >
                  {itemCount}
                </span>
              )}
            </Link>
          )}

          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <span data-testid="user-name" className="text-sm font-medium text-muted">
                {user.displayName}
              </span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-3"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
