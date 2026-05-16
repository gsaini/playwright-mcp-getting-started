/**
 * @file Auth context — mock username/password login backed by sessionStorage.
 *
 * The credentials are hard-coded (`demo / demo`). This is a demo app, not a
 * real auth system. The login function is intentionally async with a small
 * delay so the validator can observe a loading state.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "nimbus.user";

/**
 * @typedef {{ username: string, displayName: string }} User
 */

/**
 * @type {React.Context<{
 *   user: User | null,
 *   login: (username: string, password: string) => Promise<{ ok: true } | { ok: false, error: string }>,
 *   logout: () => void,
 * } | null>}
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  /** @type {[User | null, React.Dispatch<React.SetStateAction<User | null>>]} */
  const [user, setUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const login = useCallback(async (username, password) => {
    // Simulated network latency so the UI gets to render its loading state.
    // The 800ms delay is comfortably longer than the click → wait round-trip
    // a remote driver (Playwright MCP) needs to observe the transient state.
    await new Promise((r) => setTimeout(r, 800));
    if (username.trim() === "demo" && password === "demo") {
      setUser({ username: "demo", displayName: "Demo Shopper" });
      return { ok: true };
    }
    return { ok: false, error: "Invalid username or password" };
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
