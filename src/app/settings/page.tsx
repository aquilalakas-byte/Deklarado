"use client";

import { AreaPicker } from "@/components/AreaPicker";
import { ClientOnly } from "@/components/ClientOnly";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Disclaimer, Loading } from "@/components/Notices";
import { getArea, placeLabel } from "@/lib/areas";
import { levelName, useT, type TKey } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { LEVELS, type Level } from "@/lib/types";

export default function SettingsPage() {
  return <ClientOnly fallback={<Loading />}><Settings /></ClientOnly>;
}

const SOURCES: [TKey, TKey][] = [
  ["settings.sources.gma", "settings.sources.gma.body"],
  ["settings.sources.lgu", "settings.sources.lgu.body"],
  ["settings.sources.deped", "settings.sources.deped.body"],
  ["settings.sources.pagasa", "settings.sources.pagasa.body"],
];

function Settings() {
  const { prefs, update } = usePrefs();
  const { t } = useT();
  const area = getArea(prefs.areaCode);
  const allLevels = prefs.levels.length === 0;

  function toggle(level: Level) {
    const next = prefs.levels.includes(level) ? prefs.levels.filter((l) => l !== level) : [...prefs.levels, level];
    // Ticking every level is the same as "All levels"
    update({ levels: next.length === LEVELS.length ? [] : next });
  }

  const card = "rounded-2xl border border-line bg-surface p-4";
  // Put the place name in bold inside the translated sentence
  const [before, after] = t("settings.area.showing", { place: "\u0000" }).split("\u0000");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">{t("settings.title")}</h1>

      <section className={card}>
        <h2 className="mb-3 font-semibold">{t("settings.language")}</h2>
        <LanguageSwitch />
      </section>

      <section className={card}>
        <h2 className="font-semibold">{t("settings.area")}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          {area ? <>{before}<strong className="text-text">{placeLabel(area.code, t)}</strong>{after}</> : t("settings.area.choose")}
        </p>
        <AreaPicker value={prefs.areaCode} onChange={(code) => update({ areaCode: code })} />
      </section>

      <section className={card}>
        <h2 className="font-semibold">{t("settings.levels")}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">{t("settings.levels.body")}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => update({ levels: [] })}
            aria-pressed={allLevels}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${allLevels ? "border-brand bg-brand text-brand-ink" : "border-line text-muted hover:text-text"}`}
          >
            {t("levels.all")}
          </button>
          {LEVELS.map((l) => {
            const on = prefs.levels.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => toggle(l.id)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${on ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-text"}`}
              >
                {levelName(t, l.id)}
              </button>
            );
          })}
        </div>
      </section>

      <NotificationSettings areaCode={prefs.areaCode} levels={prefs.levels} />

      <section className={card}>
        <label className="flex cursor-pointer items-start justify-between gap-4">
          <span>
            <span className="block font-semibold">{t("sample.title")}</span>
            <span className="mt-1 block text-sm text-muted">{t("sample.body")}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={prefs.sample}
            onChange={(e) => update({ sample: e.target.checked })}
            className="mt-1 size-5 shrink-0 accent-[var(--brand)]"
          />
        </label>
      </section>

      <section className={card}>
        <h2 className="font-semibold">{t("settings.sources")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settings.sources.every")}</p>
        <ul className="mt-2 space-y-2 text-sm text-muted">
          {SOURCES.map(([name, body]) => (
            <li key={name}><strong className="text-text">{t(name)}</strong> {t(body)}</li>
          ))}
        </ul>
      </section>

      <Disclaimer />
    </div>
  );
}
