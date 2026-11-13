"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";
import { promptInstall, useInstallMode, type InstallMode } from "@/lib/install";
import { Logo } from "./Header";

const DISMISS_KEY = "deklarado:install-dismissed";
const DISMISS_EVENT = "deklarado:install-dismissed-changed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}
function subscribeDismissed(cb: () => void) {
  window.addEventListener(DISMISS_EVENT, cb);
  return () => window.removeEventListener(DISMISS_EVENT, cb);
}

/** Share icon as it looks on iPhone (square with an up arrow). */
const IosShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline align-text-bottom">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);

/** Step-by-step guide for browsers without a one-tap install (iPhone, in-app browsers, others). */
function Guide({ mode, onClose }: { mode: InstallMode; onClose: () => void }) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const steps =
    mode === "ios" ? [t("install.ios.1"), t("install.ios.2"), t("install.ios.3")]
    : mode === "inapp" ? [t("install.inapp.1"), t("install.inapp.2")]
    : [t("install.manual.1"), t("install.manual.2")];

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="install-guide" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <h2 id="install-guide" className="font-semibold">{mode === "inapp" ? t("install.inapp.title") : t("install.guide.title")}</h2>
        </div>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
              <span className="pt-0.5">
                {s}
                {mode === "ios" && i === 0 && <> <IosShareIcon /></>}
              </span>
            </li>
          ))}
        </ol>
        {mode === "ios" && <p className="mt-3 text-xs text-muted">{t("install.ios.note")}</p>}
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">{t("install.ok")}</button>
      </div>
    </div>
  );
}

function useInstallAction() {
  const mode = useInstallMode();
  const [guide, setGuide] = useState(false);
  async function install() {
    if (mode === "prompt") await promptInstall();
    else setGuide(true);
  }
  return { mode, install, guide: guide && mode && mode !== "installed" && mode !== "prompt" ? <Guide mode={mode} onClose={() => setGuide(false)} /> : null };
}

/** Small banner for the Today screen. Hidden once installed or dismissed. */
export function InstallBanner() {
  const { t } = useT();
  const { mode, install, guide } = useInstallAction();
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true);

  if (!mode || mode === "installed" || dismissed) return guide;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // storage blocked — the banner just comes back next time
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  return (
    <>
      <section className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-3">
        <Logo size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("install.banner.title")}</p>
          <p className="text-xs text-muted">{t("install.banner.body")}</p>
        </div>
        <button type="button" onClick={install} className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-ink">
          {t("install.button")}
        </button>
        <button type="button" onClick={dismiss} aria-label={t("install.dismiss")} className="shrink-0 rounded-lg p-1 text-muted hover:bg-surface hover:text-text">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </section>
      {guide}
    </>
  );
}

/** Card for the Settings screen (always available, even after dismissing the banner). */
export function InstallCard() {
  const { t } = useT();
  const { mode, install, guide } = useInstallAction();
  if (!mode) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("install.card.title")}</h2>
        {mode === "installed" && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok">{t("install.installed")}</span>}
      </div>
      <p className="mt-1 text-sm text-muted">{mode === "installed" ? t("install.card.installed") : t("install.card.body")}</p>
      {mode !== "installed" && (
        <button type="button" onClick={install} className="mt-3 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">
          {t("install.button")}
        </button>
      )}
      {guide}
    </section>
  );
}
