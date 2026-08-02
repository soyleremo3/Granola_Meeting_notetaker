import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense-in-depth: proxy.ts already redirects unauthenticated requests
  // away from /dashboard, but a matcher misconfiguration could silently
  // remove that coverage, so this check must not rely on proxy.ts alone.
  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
