import { PlanCard } from "@/components/pricing/plan-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCheckoutUrl } from "@/lib/lemonsqueezy/checkout";

export const metadata = {
  title: "Fiyatlandırma — Not Defteri",
};

const FREE_FEATURES = [
  "Ayda 5 toplantıya kadar kayıt/yükleme",
  "Yerel Türkçe transkripsiyon",
  "Temel özet çıkarımı",
];

const PRO_FEATURES = [
  "Sınırsız toplantı kaydı/yüklemesi",
  "Öncelikli AI özet ve analiz",
  "Sınırsız soru-cevap",
  "Öncelikli destek",
];

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
    plan = profile?.plan ?? null;
  }

  const variantId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ID_PRO;
  const isPro = plan === "pro";

  const proCtaHref =
    !user
      ? "/signup?redirect=/pricing"
      : variantId
        ? buildCheckoutUrl({ variantId, userId: user.id, email: user.email ?? "" })
        : "/signup";

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Fiyatlandırma</h1>
        <p className="mt-3 text-muted-foreground">
          Küçük bir ekiple mi çalışıyorsunuz yoksa yoğun kullanım mı ihtiyacınız? Size uygun planı
          seçin, istediğiniz zaman yükseltin.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <PlanCard
          name="Ücretsiz"
          price="0₺"
          priceSuffix="/ay"
          description="Denemek ve az sayıda toplantı için."
          features={FREE_FEATURES}
          ctaHref={user ? "/dashboard" : "/signup"}
          ctaLabel={user ? (isPro ? "Panele Git" : "Mevcut Planınız") : "Ücretsiz Başla"}
          ctaDisabled={Boolean(user) && !isPro}
        />
        <PlanCard
          name="Pro"
          price="149₺"
          priceSuffix="/ay"
          description="Yoğun kullanım ve tam özellikler için."
          features={PRO_FEATURES}
          ctaHref={isPro ? "/dashboard/account" : proCtaHref}
          ctaLabel={isPro ? "Aktif Plan" : "Pro'ya Geç"}
          highlighted
        />
      </div>
    </div>
  );
}
