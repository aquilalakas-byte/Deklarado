"use client";

import { useEffect, useState } from "react";
import { usePrefs } from "./prefs";
import type { AnnouncementsResponse } from "./types";

type State = {
  key: string;
  data: AnnouncementsResponse | null;
  error: string | null;
  offline: boolean;       // true when the answer came from this phone's saved copy (no internet)
  savedAt: string | null; // when that saved copy was made
};

/** Loads announcements for some areas and dates. Pass `null` to load nothing. */
export function useAnnouncements(areaCodes: string[] | null, from: string, to: string) {
  const { prefs } = usePrefs();
  const key = areaCodes ? `${areaCodes.join(",")}|${from}|${to}|${prefs.sample ? 1 : 0}` : "";
  const [state, setState] = useState<State>({ key: "", data: null, error: null, offline: false, savedAt: null });

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const [areas, , , sample] = key.split("|");
    const qs = new URLSearchParams({ areas, from, to });
    if (sample === "1") qs.set("sample", "1");
    fetch(`/api/announcements?${qs}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        // The service worker marks answers it served from its saved copy (see public/sw.js).
        const savedAt = r.headers.get("x-deklarado-saved-at");
        return { data: body as AnnouncementsResponse, offline: !!savedAt, savedAt };
      })
      .then(({ data, offline, savedAt }) => alive && setState({ key, data, error: null, offline, savedAt }))
      .catch((e: Error) => alive && setState({ key, data: null, error: e.message || "Could not load announcements", offline: false, savedAt: null }));
    return () => {
      alive = false;
    };
  }, [key, from, to]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    offline: current && state.offline,
    savedAt: current ? state.savedAt : null,
    loading: !!key && !current,
  };
}
