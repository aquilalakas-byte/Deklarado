"use client";

import { useState } from "react";
import { displayName, getArea, nearestTown, provincesOf, regions, townsOf } from "@/lib/areas";
import { LocateIcon } from "./Icons";

type Props = { value: string | null; onChange: (code: string) => void };

/** "Use my location" button + Region → Province → City/Town dropdowns. */
export function AreaPicker({ value, onChange }: Props) {
  const current = getArea(value);
  const currentProvince = current?.parent_code ?? provincesOf(regions()[0]?.code ?? "")[0]?.code ?? "";
  const [province, setProvince] = useState(currentProvince);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const region = getArea(province)?.parent_code ?? regions()[0]?.code ?? "";

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setMessage("This browser can't share location. Please pick your town below.");
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const hit = nearestTown(pos.coords.latitude, pos.coords.longitude);
        if (!hit) {
          setMessage("You seem to be outside Pampanga, which is all Deklarado covers for now. Pick a town below.");
          return;
        }
        setProvince(hit.area.parent_code ?? province);
        onChange(hit.area.code);
        setMessage(`Found you near ${displayName(hit.area)}. You can change it below.`);
      },
      (err) => {
        setLocating(false);
        setMessage(err.code === err.PERMISSION_DENIED
          ? "Location permission was denied. Pick your town below instead."
          : "Couldn't get your location. Pick your town below.");
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
        {locating ? "Finding your town…" : "Use my location"}
      </button>
      <p className="text-xs text-muted">Your location stays on your phone — it&apos;s only used to find the nearest town.</p>
      {message && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm" role="status">{message}</p>}

      <div className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium">
          Region
          <select className={select} value={region} disabled>
            {regions().map((r) => <option key={r.code} value={r.code}>{displayName(r)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Province
          <select className={select} value={province} onChange={(e) => setProvince(e.target.value)}>
            {provincesOf(region).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          City / Town
          <select className={select} value={current?.parent_code === province ? current.code : ""} onChange={(e) => e.target.value && onChange(e.target.value)}>
            <option value="" disabled>Choose your city or town</option>
            {townsOf(province).map((t) => <option key={t.code} value={t.code}>{displayName(t)}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
