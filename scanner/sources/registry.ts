// Official websites the scanner reads by RSS. Keep in sync with supabase/seed/0002_sources.sql.
//
// Checked in November 2026:
//   ✔ readable:  City of San Fernando, Angeles City, Guagua, Lubao, DepEd (central office)
//   ✘ blocked:   Mabalacat City (Cloudflare bot check), Apalit, DepEd Region III (403 for automated requests)
//   ✘ no feed:   Province of Pampanga (feed has no dated items); PIA (Cloudflare bot check)
// Blocked sites are skipped — Deklarado never tries to get around bot protection.

export type RssSource = { name: string; url: string; areaCode: string; areaName: string; nationalOnly?: boolean };

export const RSS_SOURCES: RssSource[] = [
  { name: "City of San Fernando – Website", url: "https://cityofsanfernando.gov.ph/feed/", areaCode: "035416000", areaName: "City of San Fernando" },
  { name: "Angeles City – Website", url: "https://www.angelescity.gov.ph/feed/", areaCode: "035401000", areaName: "City of Angeles" },
  { name: "Guagua – Website", url: "https://guagua.gov.ph/feed/", areaCode: "035407000", areaName: "Guagua" },
  { name: "Lubao – Website", url: "https://lubao.gov.ph/feed/", areaCode: "035408000", areaName: "Lubao" },
  { name: "DepEd – Website", url: "https://www.deped.gov.ph/feed/", areaCode: "000000000", areaName: "Philippines", nationalOnly: true },
];
