"use client";

import { useEffect, useState } from "react";
import type { AnnouncementsResponse } from "./types";

type State = { key: string; data: AnnouncementsResponse | null; error: string | null };

/** Loads announcements for some areas and dates. Pass `null` to load nothing. */
export function useAnnouncements(areaCodes: string[] | null, from: string, to: string) {
  const key = areaCodes ? `${areaCodes.join(",")}|${from}|${to}` : "";
  const [state, setState] = useState<State>({ key: "", data: null, error: null });

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const [areas] = key.split("|");
    const qs = new URLSearchParams({ areas, from, to });
    fetch(`/api/announcements?${qs}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        return body as AnnouncementsResponse;
      })
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((e: Error) => alive && setState({ key, data: null, error: e.message || "Could not load announcements" }));
    return () => {
      alive = false;
    };
  }, [key, from, to]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !!key && !current,
  };
}
