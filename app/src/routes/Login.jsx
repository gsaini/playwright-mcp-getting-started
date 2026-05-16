/**
 * @file Login route — username/password form with inline error and loading
 * state. Redirects to the catalogue (or to the page the user came from) on
 * success.
 */

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.jsx";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return null;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await login(username, password);
    setSubmitting(false);
    if (res.ok) {
      navigate(from, { replace: true });
    } else {
      setError(res.error);
    }
  }

  return (
    <section
      aria-labelledby="login-heading"
      className="mx-auto max-w-sm rounded-(--radius-card) border border-border bg-surface-2 p-8 shadow-sm"
    >
      <h1 id="login-heading" className="text-2xl font-semibold tracking-tight">
        Welcome back
      </h1>
      <p className="mt-1 text-sm text-muted">Sign in to browse the Nimbus Gear catalogue.</p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Username
          <input
            id="username"
            name="username"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-base font-normal text-fg focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-base font-normal text-fg focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          />
        </label>

        {error && (
          <p
            id="login-error"
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-xs text-muted">
          Hint: <code className="font-mono">demo / demo</code>
        </p>
      </form>
    </section>
  );
}
