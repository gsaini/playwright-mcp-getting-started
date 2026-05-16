/**
 * @file Theme context — light / dark / system tri-state with persistence.
 *
 * `theme` is the user's preference: `"light"`, `"dark"`, or `"system"`.
 * `resolvedTheme` is the actual mode being rendered (`"light"` or `"dark"`),
 * derived from `theme` plus the OS preference when `theme === "system"`.
 *
 * The provider keeps the `.dark` class on `<html>` in sync, persists the
 * preference to localStorage, and re-evaluates when the OS preference
 * changes (only effective while in `"system"` mode).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** @typedef {"light" | "dark" | "system"} ThemePreference */
/** @typedef {"light" | "dark"} ResolvedTheme */

const STORAGE_KEY = "nimbus.theme";

/**
 * @type {React.Context<{
 *   theme: ThemePreference,
 *   resolvedTheme: ResolvedTheme,
 *   setTheme: (next: ThemePreference) => void,
 *   toggle: () => void,
 * } | null>}
 */
const ThemeContext = createContext(null);

/**
 * Read the OS-level dark-mode preference.
 *
 * @returns {ResolvedTheme}
 */
function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Resolve a preference into the concrete theme to render.
 *
 * @param {ThemePreference} pref
 * @returns {ResolvedTheme}
 */
function resolve(pref) {
  return pref === "system" ? getSystemTheme() : pref;
}

/**
 * Root provider. Wrap once near the app root.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "system";
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => resolve(theme));

  useEffect(() => {
    const next = resolve(theme);
    setResolvedTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for OS-level changes only when following the system preference.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = getSystemTheme();
      setResolvedTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next) => setThemeState(next), []);
  const toggle = useCallback(() => {
    setThemeState((curr) => {
      const current = resolve(curr);
      return current === "dark" ? "light" : "dark";
    });
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggle }),
    [theme, resolvedTheme, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook accessor. Throws if used outside the provider — failing loudly is
 * better than silently returning `null`.
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
