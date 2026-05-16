/**
 * @file Cart context — quantity map keyed by product id, persisted to
 * sessionStorage so the cart survives refreshes during a single demo run.
 *
 * The cart is intentionally derived: the canonical state is a sparse object
 * `{ [productId]: quantity }`. Anything that needs item details, subtotals,
 * or item counts derives them from that map plus the {@link products} data.
 * This keeps invariants simple — there's only one place a quantity can live.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { getProduct } from "../data/products.js";

const STORAGE_KEY = "nimbus.cart";

/** @typedef {Record<string, number>} CartItems */

/** @typedef {{ items: CartItems }} CartState */

/**
 * @typedef {(
 *   | { type: "ADD",    id: string, qty?: number }
 *   | { type: "SET",    id: string, qty: number }
 *   | { type: "REMOVE", id: string }
 *   | { type: "CLEAR" }
 * )} CartAction
 */

/**
 * @param {CartState} state
 * @param {CartAction} action
 * @returns {CartState}
 */
function reducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const next = { ...state.items };
      next[action.id] = (next[action.id] ?? 0) + (action.qty ?? 1);
      return { items: next };
    }
    case "SET": {
      const next = { ...state.items };
      if (action.qty <= 0) delete next[action.id];
      else next[action.id] = action.qty;
      return { items: next };
    }
    case "REMOVE": {
      const next = { ...state.items };
      delete next[action.id];
      return { items: next };
    }
    case "CLEAR":
      return { items: {} };
    default:
      return state;
  }
}

/** @returns {CartState} */
function initial() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { items: JSON.parse(raw) };
  } catch {
    /* fall through */
  }
  return { items: {} };
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const add = useCallback((id, qty = 1) => dispatch({ type: "ADD", id, qty }), []);
  const set = useCallback((id, qty) => dispatch({ type: "SET", id, qty }), []);
  const remove = useCallback((id) => dispatch({ type: "REMOVE", id }), []);
  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);

  /** Detailed line items, joined with product data. */
  const lines = useMemo(() => {
    return Object.entries(state.items)
      .map(([id, qty]) => {
        const product = getProduct(id);
        if (!product) return null;
        return { product, qty, lineTotal: product.price * qty };
      })
      .filter(Boolean);
  }, [state.items]);

  const itemCount = useMemo(
    () => Object.values(state.items).reduce((a, b) => a + b, 0),
    [state.items],
  );
  const subtotal = useMemo(() => lines.reduce((a, l) => a + l.lineTotal, 0), [lines]);

  const value = useMemo(
    () => ({ items: state.items, lines, itemCount, subtotal, add, set, remove, clear }),
    [state.items, lines, itemCount, subtotal, add, set, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
