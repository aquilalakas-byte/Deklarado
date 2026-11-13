import type { Announcement, Level } from "./types";
import { LEVELS } from "./types";
import { timeLabel } from "./dates";

export type DayState = "none" | "suspended" | "partial" | "online" | "holiday";

export type DayStatus = {
  state: DayState;
  headline: string;     // big text on the card
  detail: string;       // one line under it
  matches: Announcement[];
};

/** Does this announcement affect someone who cares about `levels` ([] = everyone)? */
export function appliesToLevels(a: Announcement, levels: Level[]): boolean {
  if (levels.length === 0 || a.levels.includes("all")) return true;
  return a.levels.some((l) => l !== "all" && levels.includes(l));
}

export function levelsText(a: Pick<Announcement, "levels">): string {
  if (a.levels.includes("all")) return "All levels";
  return LEVELS.filter((l) => a.levels.includes(l.id)).map((l) => l.short).join(", ");
}

export const sectorText = (s: Announcement["sector"]) =>
  s === "both" ? "Public & private" : s === "public" ? "Public schools" : "Private schools";

/** Works out the answer for one day, for one person's area and levels. */
export function dayStatus(all: Announcement[], date: string, levels: Level[]): DayStatus {
  const sameDay = all.filter((a) => a.date_covered === date);
  const resumed = sameDay.some((a) => a.kind === "resumption");
  const matches = sameDay.filter((a) => a.kind !== "resumption" && a.kind !== "work_suspension" && appliesToLevels(a, levels));

  if (matches.length === 0) {
    return {
      state: "none",
      headline: "No suspension announced",
      detail: resumed ? "A suspension was lifted — classes resume." : "Classes as usual unless an announcement comes in.",
      matches: sameDay.filter((a) => a.kind === "resumption"),
    };
  }

  const holiday = matches.find((a) => a.kind === "holiday");
  if (holiday) {
    return { state: "holiday", headline: "Walang pasok", detail: "Non-working day — no classes and no work.", matches };
  }

  // Covers every level this person follows (or all levels)?
  const coversUser = (a: Announcement) =>
    a.levels.includes("all") || (levels.length > 0 && levels.every((l) => a.levels.includes(l)));
  const allLevelsForUser = matches.some(coversUser);
  const wholeDay = matches.find((a) => !a.starts_at && !a.f2f_only);
  const onlineOnly = matches.every((a) => a.f2f_only);
  const afternoon = matches.filter((a) => a.starts_at).map((a) => a.starts_at!).sort()[0];

  if (onlineOnly) {
    return { state: "online", headline: "No face-to-face classes", detail: "Classes move online / modular. Check with your school.", matches };
  }
  if (wholeDay && allLevelsForUser) {
    return { state: "suspended", headline: "Walang pasok", detail: `Classes suspended — ${levelsText(wholeDay).toLowerCase()}.`, matches };
  }
  if (afternoon && !wholeDay) {
    return { state: "partial", headline: `Walang pasok from ${timeLabel(afternoon)}`, detail: "Morning classes may still push through.", matches };
  }
  const first = wholeDay ?? matches[0];
  return { state: "partial", headline: "Some levels suspended", detail: `${levelsText(first)} — ${sectorText(first.sector).toLowerCase()}.`, matches };
}
