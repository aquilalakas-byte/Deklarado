export type Level = "kinder" | "elementary" | "jhs" | "shs" | "college";
export const LEVELS: { id: Level; label: string; short: string }[] = [
  { id: "kinder", label: "Kindergarten", short: "Kinder" },
  { id: "elementary", label: "Elementary", short: "Elem" },
  { id: "jhs", label: "Junior High School", short: "JHS" },
  { id: "shs", label: "Senior High School", short: "SHS" },
  { id: "college", label: "College", short: "College" },
];

export type AreaType = "national" | "region" | "province" | "city" | "municipality";

export type Area = {
  code: string;
  name: string;
  type: AreaType;
  parent_code: string | null;
  aliases: string[];
};

export type AnnouncementKind = "class_suspension" | "work_suspension" | "holiday" | "resumption";

/** One row of the `announcements` table. */
export type Announcement = {
  id: number;
  area_code: string;
  kind: AnnouncementKind;
  levels: (Level | "all")[];
  sector: "public" | "private" | "both";
  date_covered: string; // YYYY-MM-DD
  starts_at: string | null; // HH:MM[:SS]
  f2f_only: boolean;
  includes_work: boolean;
  reason: string | null;
  summary: string;
  source_name: string;
  source_url: string;
  lgu_post_url: string | null;
  is_official: boolean;
  created_at: string;
  updated_at: string;
};

export type SourceStatus = { name: string; last_checked_at: string | null; last_error: string | null };

export type AnnouncementsResponse = {
  demo: boolean;
  announcements: Announcement[];
  sources: SourceStatus[];
};
