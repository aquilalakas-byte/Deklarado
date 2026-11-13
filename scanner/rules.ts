// Automatic class suspension rules based on PAGASA Wind Signals.
//
// ⚠️ This table is EMPTY on purpose.
//
// Before October 2026, DepEd Order No. 37, s. 2022 automatically cancelled classes for certain
// grade levels at each Wind Signal. Executive Order No. 130 (signed October 28, 2026) replaced
// that system with a three-tier framework (automatic / localized / granular). The automatic tier
// now follows "technical thresholds" that DepEd and partner agencies must publish in new
// implementing guidelines — which were not yet released when this was written (November 2026).
//
// Until then, Deklarado shows Wind Signals as WEATHER ALERTS only and never invents a suspension.
//
// When DepEd publishes the thresholds, fill in this table, e.g.:
//
//   export const SIGNAL_RULES: Record<number, SignalRule> = {
//     1: { levels: ["kinder"] },
//     2: { levels: ["kinder", "elementary", "jhs", "shs"] },
//     3: { levels: "all" },
//   };
//
// and set RULES_SOURCE to the memo/circular number so users can see where the rule comes from.
// Higher signals not listed fall back to the highest rule below them.

import type { Level } from "./classify.ts";

export type SignalRule = { levels: Level[] | "all"; f2fOnly?: boolean };

export const SIGNAL_RULES: Record<number, SignalRule> = {};

export const RULES_SOURCE = "";

/** The rule that applies at a given signal level, or null if none. */
export function ruleFor(signal: number): SignalRule | null {
  for (let s = signal; s >= 1; s--) if (SIGNAL_RULES[s]) return SIGNAL_RULES[s];
  return null;
}
