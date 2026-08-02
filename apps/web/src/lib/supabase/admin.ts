import { createClient } from "@supabase/supabase-js";

// Service-role client. Bypasses Row Level Security — only ever import this
// from server-only code that never runs in the browser (the LemonSqueezy
// webhook route). Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
