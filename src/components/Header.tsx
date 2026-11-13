"use client";

import Link from "next/link";
import { useEffect } from "react";
import { getArea, displayName } from "@/lib/areas";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { PinIcon } from "./Icons";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <path d="M19 15h13c10.5 0 17 6.6 17 17s-6.5 17-17 17H19V15Zm9 8v18h4c5.3 0 8-3.3 8-9s-2.7-9-8-9h-4Z" fill="var(--brand-ink)" />
      <circle cx="49" cy="15" r="7" fill="var(--danger)" stroke="var(--brand)" strokeWidth="3" />
    </svg>
  );
}

export function Header() {
  const { prefs, ready } = usePrefs();
  const { t, lang } = useT();
  const area = getArea(prefs.areaCode);

  // Keep <html lang> in sync for screen readers and translation tools.
  useEffect(() => {
    document.documentElement.lang = lang === "fil" ? "fil" : "en";
  }, [lang]);
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          <span className="text-lg">Deklarado</span>
        </Link>
        {ready && (
          <Link
            href="/settings"
            className="flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted hover:text-text"
          >
            <PinIcon width={15} height={15} className="shrink-0" />
            <span className="truncate">{area ? displayName(area) : t("header.setArea")}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
