import "server-only";
import { createClient } from "@supabase/supabase-js";

const placeholder = (v: string | undefined) => !v || v.includes("your-project") || v.startsWith("your-");

/** Read-only client (anon key). Returns null when keys aren't set yet (demo mode). */
export function supabaseReader() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (placeholder(url) || placeholder(key)) return null;
  return createClient(url!, key!, { auth: { persistSession: false } });
}

/** Full-access client (service role key) — server code only. Returns null when not set. */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (placeholder(url) || placeholder(key)) return null;
  return createClient(url!, key!, { auth: { persistSession: false } });
}
