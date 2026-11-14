"use client";

import { useState } from "react";
import { DEFAULT_PROVINCE, displayName, getArea, nearestTown, provincesOf, regions, townsOf } from "@/lib/areas";
import { useT } from "@/lib/i18n";
import { LocateIcon } from "./Icons";

type Props = { value: string | null; onChange: (code: string) => void };

/** "Use my location" button + Region → Province → City/Town dropdowns. */
export function AreaPicker({ value, onChange }: Props) {
  const current = getArea(value);
  const [province, setProvince] = useState(current?.parent_code ?? DEFAULT_PROVINCE);
  const [region, setRegion] = useState(getArea(current?.parent_code ?? DEFAULT_PROVINCE)?.parent_code ?? "");
  const { t } = useT();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);


  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setMessage(t("area.noGeo"));
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const hit = nearestTown(pos.coords.latitude, pos.coords.longitude);
        if (!hit) {
          setMessage(t("area.outside"));
          return;
        }
        setProvince(hit.area.parent_code ?? province);
        setRegion(getArea(hit.area.parent_code)?.parent_code ?? region);
        onChange(hit.area.code);
        setMessage(t("area.found", { town: displayName(hit.area) }));
      },
      (err) => {
        setLocating(false);
        setMessage(err.code === err.PERMISSION_DENIED
          ? t("area.denied")
          : t("area.failed"));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  }

  const select = "w-full rounded-xl border border-line px-3 py-2.5 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink transition hover:opacity-90 disabled:opacity-60"
      >
        <LocateIcon width={18} height={18} />
        {locating ? t("area.locating") : t("area.useLocation")}
      </button>
      <p className="text-xs text-muted">{t("area.privacy")}</p>
      {message && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm" role="status">{message}</p>}

      <div className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium">
          {t("area.region")}
          <select className={select} value={region} onChange={(e) => { setRegion(e.target.value); setProvince(provincesOf(e.target.value)[0]?.code ?? ""); }}>
            {regions().map((r) => <option key={r.code} value={r.code}>{displayName(r)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t("area.province")}
          <select className={select} value={province} onChange={(e) => setProvince(e.target.value)}>
            {provincesOf(region).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {t("area.town")}
          <select className={select} value={current?.parent_code === province ? current.code : ""} onChange={(e) => e.target.value && onChange(e.target.value)}>
            <option value="" disabled>{t("area.choose")}</option>
            {townsOf(province).map((town) => <option key={town.code} value={town.code}>{displayName(town)}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
