"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Settings, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { HealthStatus } from "@/lib/types";

export function AiSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await api.health();
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="AI Ayarları Hakkında">
            <Settings className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yapay Zeka Ayarları</DialogTitle>
          <DialogDescription>
            Konuşma tanıma (transkripsiyon) her zaman bilgisayarınızda, tamamen yerel çalışır.
            OpenRouter isteğe bağlıdır ve yalnızca özet/soru-cevap kalitesini artırır.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-muted-foreground">Yerel transkripsiyon</span>
            <span className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Her zaman kullanılabilir
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-muted-foreground">OpenRouter (harici AI)</span>
            {loading ? (
              <span className="text-muted-foreground">Kontrol ediliyor...</span>
            ) : health?.ai_enabled ? (
              <span className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Etkin — {health.openrouter_model}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <XCircle className="h-4 w-4" />
                Kapalı (yerel modda)
              </span>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            OpenRouter kapalıyken ya da geçici olarak yanıt vermediğinde uygulama otomatik olarak
            yerel çıkarım yöntemine geçer; bu, sonuçların üzerinde her zaman açıkça belirtilir ve
            hiçbir toplantı yalnızca bu yüzden başarısız olmaz. Ücretsiz modeller zaman zaman yavaş
            veya geçici olarak kullanılamaz olabilir. API anahtarınız yalnızca sunucudaki{" "}
            <code className="rounded bg-muted px-1 py-0.5">apps/api/.env</code> dosyasında tutulur
            ve hiçbir zaman tarayıcıya gönderilmez.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
