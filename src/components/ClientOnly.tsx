"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};

/** True only in the browser (false while the page is pre-rendered on the server). */
export const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

/**
 * Renders children only in the browser. Use it for anything that depends on "today" or on
 * saved settings, so a pre-built page never shows a stale date.
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return useIsClient() ? children : fallback;
}
