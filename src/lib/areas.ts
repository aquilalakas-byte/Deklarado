import areasData from "@/data/areas.json";
import coordinates from "@/data/coordinates.json";
import type { Area } from "./types";

export const AREAS = areasData as Area[];
const BY_CODE = new Map(AREAS.map((a) => [a.code, a]));
const COORDS = coordinates as Record<string, { lat: number; lng: number }>;

export const NATIONAL_CODE = "000000000";

export function getArea(code: string | null | undefined): Area | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

export const isTown = (a: Area) => a.type === "city" || a.type === "municipality";

export const regions = () => AREAS.filter((a) => a.type === "region");
export const provincesOf = (regionCode: string) => AREAS.filter((a) => a.type === "province" && a.parent_code === regionCode);
export const townsOf = (provinceCode: string) =>
  AREAS.filter((a) => isTown(a) && a.parent_code === provinceCode).sort((x, y) => displayName(x).localeCompare(displayName(y)));

/** The area plus everything above it: town → province → region → Philippines. */
export function lineage(code: string): Area[] {
  const out: Area[] = [];
  let cur = getArea(code);
  while (cur) {
    out.push(cur);
    cur = getArea(cur.parent_code);
  }
  return out;
}

/** Every area whose announcements affect people in `code` (the place itself, its province, its region, nationwide). */
export const affectingCodes = (code: string) => lineage(code).map((a) => a.code);

/** Every area code inside `code` (e.g. a province → itself + all its towns). */
export function descendantCodes(code: string): string[] {
  const out = [code];
  for (const a of AREAS) if (a.parent_code === code) out.push(...descendantCodes(a.code));
  return out;
}

/** "City of San Fernando" → "San Fernando City" reads better in lists; keep municipalities as-is. */
export function displayName(a: Area): string {
  if (a.type === "region") return a.aliases[0] ? `${a.aliases[0]} (${a.name})` : a.name;
  const m = a.name.match(/^City of (.+)$/);
  return m ? `${m[1]} City` : a.name;
}

export function placeLabel(code: string): string {
  const a = getArea(code);
  if (!a) return "Unknown area";
  if (a.type === "national") return "Nationwide";
  if (a.type === "province") return `${a.name} (whole province)`;
  const prov = getArea(a.parent_code);
  return prov && isTown(a) ? `${displayName(a)}, ${prov.name}` : displayName(a);
}

const toRad = (d: number) => (d * Math.PI) / 180;
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Guess the user's town from GPS: the nearest town center. Runs entirely on the device.
 * Returns null when the nearest town is far away (outside the pilot area).
 */
export function nearestTown(lat: number, lng: number, maxKm = 20): { area: Area; km: number } | null {
  let best: { area: Area; km: number } | null = null;
  for (const [code, point] of Object.entries(COORDS)) {
    const area = getArea(code);
    if (!area) continue;
    const d = km({ lat, lng }, point);
    if (!best || d < best.km) best = { area, km: d };
  }
  return best && best.km <= maxKm ? best : null;
}
