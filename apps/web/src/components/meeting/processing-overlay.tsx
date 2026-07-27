"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProcessingStatus } from "@/lib/types";

const STAGES = [
  { key: "preparing", label: "Dosya hazırlanıyor" },
  { key: "converting", label: "Ses dönüştürülüyor" },
  { key: "transcribing", label: "Türkçe konuşma metne çevriliyor" },
  { key: "summarizing", label: "Toplantı notları hazırlanıyor" },
  { key: "extracting_todos", label: "Yapılacak işler çıkarılıyor" },
  { key: "saving", label: "Sonuçlar kaydediliyor" },
];

export function ProcessingOverlay({ status }: { status: ProcessingStatus }) {
  const currentIndex = STAGES.findIndex((s) => s.label === status.stage_label);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div>
        <p className="text-lg font-medium">Toplantınız işleniyor</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Bu işlem ses uzunluğuna göre birkaç dakika sürebilir. Sayfayı kapatabilirsiniz, işlem
          arka planda devam eder.
        </p>
      </div>

      <ul className="flex w-full flex-col gap-2 text-left">
        {STAGES.map((stage, idx) => {
          const isDone = currentIndex !== -1 && currentIndex > idx;
          const isCurrent = idx === currentIndex;
          return (
            <li
              key={stage.key}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                isCurrent && "bg-accent font-medium text-accent-foreground"
              )}
            >
              {isDone && !isCurrent ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              )}
              {stage.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
