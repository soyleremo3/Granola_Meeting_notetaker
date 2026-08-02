import Link from "next/link";
import { CheckSquare, Languages, Lock, Mic, Sparkles, Zap } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Mic,
    title: "Otomatik Kayıt",
    description: "Google Meet ve Zoom görüşmelerinizi tek tıkla kaydedin ya da ses dosyası yükleyin.",
  },
  {
    icon: Languages,
    title: "Türkçe Döküm",
    description: "Konuşmalarınız yerel olarak yüksek doğrulukla Türkçe metne çevrilir.",
  },
  {
    icon: Sparkles,
    title: "Akıllı Özet",
    description: "Yapay zeka, toplantının özetini ve öne çıkan noktalarını sizin için çıkarır.",
  },
  {
    icon: CheckSquare,
    title: "Yapılacaklar Listesi",
    description: "Toplantıda alınan aksiyon maddeleri otomatik olarak tespit edilip listelenir.",
  },
  {
    icon: Lock,
    title: "Gizlilik Odaklı",
    description: "Ses ve döküm verileriniz kendi cihazınızda işlenir, sizin kontrolünüzde kalır.",
  },
  {
    icon: Zap,
    title: "Anında Soru-Cevap",
    description: "Toplantı içeriğine dair sorular sorun, cevaplar transkriptten anında bulunsun.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Yerel ve gizlilik odaklı toplantı asistanı
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Toplantılarınızı dinleyin, biz notunu çıkaralım.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Not Defteri; Google Meet ve Zoom görüşmelerinizi kaydeder, Türkçe metne çevirir ve
            akıllı özet ile yapılacaklar listesi çıkarır. Kaydolun, birkaç dakikada kullanmaya
            başlayın.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Ücretsiz Başla
            </Link>
            <Link href="/pricing" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Fiyatlandırmayı İncele
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Toplantı sonrası işleri sizin yerinize halleder
            </h2>
            <p className="mt-2 text-muted-foreground">
              Kayıttan özete, özetten aksiyon maddelerine — tüm süreç otomatik.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-4.5 w-4.5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Hemen ücretsiz hesap açın
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Kredi kartı gerekmez. Kaydolun, ilk toplantınızı işleyin, isterseniz daha sonra Pro
            plana geçin.
          </p>
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Ücretsiz Başla
          </Link>
        </div>
      </section>
    </>
  );
}
