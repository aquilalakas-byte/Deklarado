// Loads src/data/areas.json into the Supabase "areas" table (insert new, update changed).
// Same result as running supabase/seed/0001_areas.sql in the SQL Editor, but from the terminal.
//
// Run:  node scripts/load-areas.mjs      (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local)

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

const db = createClient(url, key, { auth: { persistSession: false } });
const areas = JSON.parse(await readFile("src/data/areas.json", "utf8"));

// Parents first (parent_code is a foreign key): national → regions → provinces → towns
const order = { national: 0, region: 1, province: 2, city: 3, municipality: 3 };
const sorted = [...areas].sort((a, b) => order[a.type] - order[b.type]);
for (let i = 0; i < sorted.length; i += 500) {
  const batch = sorted.slice(i, i + 500);
  const { error } = await db.from("areas").upsert(batch, { onConflict: "code" });
  if (error) throw new Error(`Batch ${i / 500 + 1}: ${error.message}`);
}
const { count } = await db.from("areas").select("code", { count: "exact", head: true });
console.log(`Loaded ${sorted.length} areas. The table now has ${count} areas.`);
