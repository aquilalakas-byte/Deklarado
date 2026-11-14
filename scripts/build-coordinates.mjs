// Looks up the center point of each city/town in src/data/areas.json using OpenStreetMap's
// Nominatim search, and writes src/data/coordinates.json.
//
// The app uses these points to guess the user's town from their GPS position ON THE DEVICE —
// the user's location is never sent anywhere.
//
// Run:  node scripts/build-coordinates.mjs
// Towns that already have a point are skipped, and progress is saved every 25 towns, so it can be
// stopped and resumed. Nominatim allows at most 1 request per second (~30 minutes for the whole country).

import { readFile, writeFile } from "node:fs/promises";

const FILE = "src/data/coordinates.json";
const areas = JSON.parse(await readFile("src/data/areas.json", "utf8"));
const byCode = Object.fromEntries(areas.map((a) => [a.code, a]));
let out = {};
try { out = JSON.parse(await readFile(FILE, "utf8")); } catch { /* first run */ }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = () => writeFile(FILE, JSON.stringify(Object.fromEntries(Object.entries(out).sort())) + "\n");

async function search(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(q)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "DeklaradoCapstoneBuildScript/1.0" } });
      await sleep(1100);
      if (!res.ok) return null;
      const [hit] = await res.json();
      return hit ?? null;
    } catch {
      await sleep(5000 * attempt); // network hiccup — wait and try again
    }
  }
  return null;
}

const todo = areas.filter((a) => (a.type === "city" || a.type === "municipality") && !out[a.code]);
console.log(`${todo.length} towns to look up.`);
let n = 0;
const missing = [];
for (const a of todo) {
  const province = byCode[a.parent_code]?.name ?? "";
  const plain = a.name.replace(/^City of /, "");
  const hit = (await search(`${a.name}, ${province}, Philippines`)) ?? (await search(`${plain}, ${province}, Philippines`));
  if (hit) out[a.code] = { lat: Number(Number(hit.lat).toFixed(5)), lng: Number(Number(hit.lon).toFixed(5)) };
  else missing.push(`${a.name}, ${province}`);
  if (++n % 25 === 0) { await save(); console.log(`${n}/${todo.length}`); }
}
await save();
console.log(`Done. ${Object.keys(out).length} coordinates. Not found: ${missing.length ? missing.join("; ") : "none"}`);
