// Looks up the center point of each city/town in src/data/areas.json using OpenStreetMap's
// Nominatim search, and writes src/data/coordinates.json.
//
// The app uses these points to guess the user's town from their GPS position ON THE DEVICE —
// the user's location is never sent anywhere.
//
// Run once (or after adding a province):  node scripts/build-coordinates.mjs
// Nominatim allows at most 1 request per second, so this takes ~30 seconds.

import { readFile, writeFile } from "node:fs/promises";

const areas = JSON.parse(await readFile("src/data/areas.json", "utf8"));
const byCode = Object.fromEntries(areas.map((a) => [a.code, a]));
const out = {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const a of areas) {
  if (a.type !== "city" && a.type !== "municipality") continue;
  const province = byCode[a.parent_code]?.name ?? "";
  const q = `${a.name}, ${province}, Philippines`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "user-agent": "DeklaradoCapstoneBuildScript/1.0" } });
  const [hit] = res.ok ? await res.json() : [];
  if (hit) {
    out[a.code] = { lat: Number(Number(hit.lat).toFixed(5)), lng: Number(Number(hit.lon).toFixed(5)) };
    console.log(`${a.name.padEnd(24)} ${out[a.code].lat}, ${out[a.code].lng}`);
  } else {
    console.warn(`! not found: ${q}`);
  }
  await sleep(1100);
}

await writeFile("src/data/coordinates.json", JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${Object.keys(out).length} coordinates.`);
