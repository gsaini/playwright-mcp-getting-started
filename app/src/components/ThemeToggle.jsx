/**
 * @file Three-button segmented control for switching theme preference.
 *
 * Renders three buttons (Light / System / Dark) with the active option
 * visually pressed. Uses semantic `role="radiogroup"` so assistive tech
 * (and the validator's accessibility-tree lookups) can address the
 * individual options by name.
 */

import { useTheme } from "../hooks/useTheme.jsx";

/** @type {Array<{ value: import("../hooks/useTheme.jsx").ThemePreference, label: string, icon: string }>} */
const OPTIONS = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "system", label: "System", icon: "🖥️" },
  { value: "dark", label: "Dark", icon: "🌙" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      data-testid="theme-toggle"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-0.5 text-xs"
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={active}
            aria-label={`${opt.label} theme`}
            onClick={() => setTheme(opt.value)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition ${
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "text-muted hover:text-fg hover:bg-surface-3"
            }`}
          >
            <span aria-hidden="true">{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
