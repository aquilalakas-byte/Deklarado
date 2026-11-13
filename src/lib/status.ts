import type { Announcement, Level } from "./types";
import { LEVELS } from "./types";
import { timeLabel } from "./dates";
import { levelName, type T } from "./i18n";

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

export function levelsText(a: Pick<Announcement, "levels">, t: T): string {
  if (a.levels.includes("all")) return t("levels.all");
  return LEVELS.filter((l) => a.levels.includes(l.id)).map((l) => levelName(t, l.id, true)).join(", ");
}

export const sectorText = (s: Announcement["sector"], t: T) =>
  t(s === "both" ? "sector.both" : s === "public" ? "sector.public" : "sector.private");

/** Works out the answer for one day, for one person's area and levels. */
export function dayStatus(all: Announcement[], date: string, levels: Level[], t: T): DayStatus {
  const sameDay = all.filter((a) => a.date_covered === date);
  const resumed = sameDay.some((a) => a.kind === "resumption");
  const matches = sameDay.filter((a) => a.kind !== "resumption" && a.kind !== "work_suspension" && appliesToLevels(a, levels));

  if (matches.length === 0) {
    return {
      state: "none",
      headline: t("status.none"),
      detail: t(resumed ? "status.resumed.detail" : "status.none.detail"),
      matches: sameDay.filter((a) => a.kind === "resumption"),
    };
  }

  if (matches.some((a) => a.kind === "holiday")) {
    return { state: "holiday", headline: t("status.walangPasok"), detail: t("status.holiday.detail"), matches };
  }

  // Covers every level this person follows (or all levels)?
  const coversUser = (a: Announcement) =>
    a.levels.includes("all") || (levels.length > 0 && levels.every((l) => a.levels.includes(l)));
  const allLevelsForUser = matches.some(coversUser);
  const wholeDay = matches.find((a) => !a.starts_at && !a.f2f_only);
  const onlineOnly = matches.every((a) => a.f2f_only);
  const afternoon = matches.filter((a) => a.starts_at).map((a) => a.starts_at!).sort()[0];

  if (onlineOnly) {
    return { state: "online", headline: t("status.online"), detail: t("status.online.detail"), matches };
  }
  if (wholeDay && allLevelsForUser) {
    return { state: "suspended", headline: t("status.walangPasok"), detail: t("status.suspended.detail", { levels: levelsText(wholeDay, t).toLowerCase() }), matches };
  }
  if (afternoon && !wholeDay) {
    return { state: "partial", headline: t("status.from", { time: timeLabel(afternoon) }), detail: t("status.from.detail"), matches };
  }
  const first = wholeDay ?? matches[0];
  return { state: "partial", headline: t("status.some"), detail: `${levelsText(first, t)} — ${sectorText(first.sector, t).toLowerCase()}.`, matches };
}
