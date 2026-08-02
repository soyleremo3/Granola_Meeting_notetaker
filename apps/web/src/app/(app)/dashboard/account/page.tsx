import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  none: "Yok",
  on_trial: "Deneme",
  active: "Aktif",
  paused: "Duraklatıldı",
  past_due: "Ödeme Gecikti",
  cancelled: "İptal Edildi",
  expired: "Süresi Doldu",
};

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_status")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "free";
  const subscriptionStatus = profile?.subscription_status ?? "none";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Hesap ve Abonelik</h1>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Hesap</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abonelik</CardTitle>
            <CardDescription>Mevcut planınız ve abonelik durumunuz.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <Badge variant={plan === "pro" ? "default" : "secondary"}>
                {plan === "pro" ? "Pro" : "Ücretsiz"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Abonelik Durumu</span>
              <span className="text-sm font-medium">
                {STATUS_LABELS[subscriptionStatus] ?? subscriptionStatus}
              </span>
            </div>

            {plan !== "pro" && (
              <Link href="/pricing" className={buttonVariants({ className: "mt-2" })}>
                Pro&apos;ya Geç
              </Link>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
