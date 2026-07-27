"use client";

import Link from "next/link";
import { Mic } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { MeetingList } from "@/components/meeting-list";

export default function MeetingsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Toplantılar</h1>
          <p className="mt-1 text-muted-foreground">
            Tüm kayıtlı toplantılarınızı arayın, filtreleyin ve inceleyin.
          </p>
        </div>
        <MeetingList
          emptyAction={
            <Link href="/new" className={buttonVariants()}>
              <Mic className="h-4 w-4" />
              Yeni Toplantı Başlat
            </Link>
          }
        />
      </main>
    </div>
  );
}
