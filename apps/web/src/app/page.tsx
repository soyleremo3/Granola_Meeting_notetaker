"use client";

import Link from "next/link";
import { Mic, Sparkles, Upload } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { MeetingList } from "@/components/meeting-list";

export default function DashboardPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <section className="mb-10 flex flex-col gap-6 rounded-2xl border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Yerel ve gizlilik odaklı toplantı asistanı
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Toplantılarınızı dinleyin, biz notunu çıkaralım.
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Google Meet veya Zoom görüşmelerinizi kaydedin, ses dosyası yükleyin; Türkçe döküm,
              özet ve yapılacaklar listesi otomatik oluşsun. Tüm veriler cihazınızda saklanır.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/new?mode=record" className={buttonVariants({ size: "lg" })}>
              <Mic className="h-4 w-4" />
              Yeni Toplantı
            </Link>
            <Link href="/new?mode=upload" className={buttonVariants({ size: "lg", variant: "outline" })}>
              <Upload className="h-4 w-4" />
              Dosya Yükle
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Son Toplantılar</h2>
            <Link href="/meetings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Tümünü Gör
            </Link>
          </div>
          <MeetingList
            limit={6}
            showControls={false}
            emptyAction={
              <Link href="/new" className={buttonVariants()}>
                <Mic className="h-4 w-4" />
                İlk Toplantını Kaydet
              </Link>
            }
          />
        </section>
      </main>
    </div>
  );
}
