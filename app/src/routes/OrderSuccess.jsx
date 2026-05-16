/**
 * @file Order-success route — confirmation screen with the generated order
 * number passed via `useLocation().state`. Falls back to `/` if a user
 * deep-links here without context, since there's nothing meaningful to show.
 */

import { Link, Navigate, useLocation } from "react-router-dom";

export default function OrderSuccess() {
  const location = useLocation();
  const orderNumber = location.state?.orderNumber;

  if (!orderNumber) return <Navigate to="/" replace />;

  return (
    <section
      aria-labelledby="success-heading"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-(--radius-card) border border-border bg-surface-2 p-10 text-center shadow-sm"
    >
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-3xl text-success"
      >
        ✓
      </div>
      <h1 id="success-heading" className="text-2xl font-semibold tracking-tight">
        Order placed
      </h1>
      <p className="text-sm text-muted">
        Thanks for shopping with Nimbus Gear. We've sent a confirmation email with tracking details.
      </p>
      <p className="font-mono text-lg">
        <span className="text-muted">Order #</span>
        <span data-testid="order-number" className="font-semibold text-fg">
          {orderNumber}
        </span>
      </p>
      <Link
        to="/"
        className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        Back to catalogue
      </Link>
    </section>
  );
}
