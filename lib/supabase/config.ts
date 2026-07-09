export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://kltxwijhluawgveykfbt.supabase.co";

export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function hasSupabaseBrowserConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
