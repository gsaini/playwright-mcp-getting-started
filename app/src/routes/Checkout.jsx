/**
 * @file Checkout route — multi-field form with inline validation, simulated
 * submission delay, and redirect-on-success to `/checkout/success` with the
 * generated order number passed via router state.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCart } from "../hooks/useCart.jsx";

/**
 * Validate form fields and return a `{ field: message }` map.
 * Empty object means everything's fine.
 *
 * @param {Record<string, string>} fields
 * @returns {Record<string, string>}
 */
function validate(fields) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!fields.fullName.trim()) errors.fullName = "Name is required";
  if (!fields.email.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = "Enter a valid email address";
  }
  if (!fields.address.trim()) errors.address = "Shipping address is required";
  if (!/^\d{16}$/.test(fields.card.replace(/\s+/g, ""))) {
    errors.card = "Card number must be 16 digits";
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(fields.expiry)) {
    errors.expiry = "Expiry must be MM/YY";
  }
  if (!/^\d{3}$/.test(fields.cvv)) errors.cvv = "CVV must be 3 digits";
  return errors;
}

/**
 * Generate a short, human-readable order number.
 *
 * @returns {string}
 */
function makeOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `NMB-${stamp}-${rand}`;
}

export default function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const navigate = useNavigate();

  const [fields, setFields] = useState({
    fullName: "",
    email: "",
    address: "",
    card: "",
    expiry: "",
    cvv: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (lines.length === 0) {
    return (
      <section className="rounded-(--radius-card) border border-dashed border-border bg-surface-2 p-10 text-center">
        <h1 className="text-2xl font-semibold">Nothing to check out</h1>
        <p className="mt-2 text-sm text-muted">Add items to your cart first.</p>
      </section>
    );
  }

  function setField(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const next = validate(fields);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    const orderNumber = makeOrderNumber();
    clear();
    setSubmitting(false);
    navigate("/checkout/success", { state: { orderNumber } });
  }

  /**
   * @param {string} name
   * @param {string} label
   * @param {object} [opts]
   */
  function field(name, label, opts = {}) {
    const id = `field-${name}`;
    const errId = `${id}-error`;
    const err = errors[name];
    return (
      <label htmlFor={id} className="flex flex-col gap-1.5 text-sm font-medium">
        {label}
        <input
          id={id}
          name={name}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          autoComplete={opts.autoComplete ?? "off"}
          placeholder={opts.placeholder}
          value={fields[name]}
          onChange={(e) => setField(name, e.target.value)}
          aria-invalid={!!err}
          aria-describedby={err ? errId : undefined}
          className={`rounded-lg border bg-surface px-3 py-2 text-base font-normal text-fg focus:outline-none focus:ring-2 ${
            err
              ? "border-danger focus:border-danger focus:ring-danger/30"
              : "border-border focus:border-brand-600 focus:ring-brand-600/30"
          }`}
        />
        {err && (
          <span id={errId} role="alert" className="text-xs font-medium text-danger">
            {err}
          </span>
        )}
      </label>
    );
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form
        onSubmit={onSubmit}
        noValidate
        aria-labelledby="checkout-heading"
        className="flex flex-col gap-6"
      >
        <h1 id="checkout-heading" className="text-3xl font-semibold tracking-tight">
          Checkout
        </h1>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-sm font-semibold uppercase tracking-wide text-muted">
            Contact &amp; shipping
          </legend>
          {field("fullName", "Full name", { autoComplete: "name" })}
          {field("email", "Email", { type: "email", autoComplete: "email" })}
          {field("address", "Shipping address", {
            placeholder: "123 Cloud St, Skyline",
            autoComplete: "street-address",
          })}
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-sm font-semibold uppercase tracking-wide text-muted">
            Payment
          </legend>
          {field("card", "Card number", {
            placeholder: "4242 4242 4242 4242",
            inputMode: "numeric",
            autoComplete: "cc-number",
          })}
          <div className="grid grid-cols-2 gap-4">
            {field("expiry", "Expiry (MM/YY)", { placeholder: "12/29", autoComplete: "cc-exp" })}
            {field("cvv", "CVV", {
              placeholder: "123",
              inputMode: "numeric",
              autoComplete: "cc-csc",
            })}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          data-testid="place-order"
          className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Placing order…" : "Place order"}
        </button>
      </form>

      <aside className="h-fit rounded-(--radius-card) border border-border bg-surface-2 p-6">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {lines.map(({ product, qty, lineTotal }) => (
            <li key={product.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-fg">{product.name}</p>
                <p className="text-xs text-muted">Qty {qty}</p>
              </div>
              <p className="font-semibold tabular-nums">${lineTotal}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="font-semibold tabular-nums">${subtotal}</dd>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <dt className="text-muted">Shipping</dt>
            <dd className="font-semibold tabular-nums">$12</dd>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-base">
            <dt className="font-semibold">Total</dt>
            <dd data-testid="checkout-total" className="text-xl font-semibold tabular-nums">
              ${subtotal + 12}
            </dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}
