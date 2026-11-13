"use client";

import { usePrefs } from "@/lib/prefs";

/** English / Filipino toggle (also in Settings). */
export function LanguageSwitch() {
  const { prefs, update } = usePrefs();
  const options = [{ id: "en", label: "English" }, { id: "fil", label: "Filipino" }] as const;
  return (
    <div className="flex justify-center" role="radiogroup" aria-label="Language / Wika">
      <div className="inline-flex rounded-full border border-line bg-surface p-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={prefs.lang === o.id}
            onClick={() => update({ lang: o.id })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${prefs.lang === o.id ? "bg-brand text-brand-ink" : "text-muted hover:text-text"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
