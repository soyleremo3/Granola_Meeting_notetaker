"use client";

import { AlertCircle, CircleHelp, ListChecks, ListTodo, ShieldAlert, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import type { MeetingAnalysis } from "@/lib/types";

function Section({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icon}
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, idx) => (
          <li key={idx} className="rounded-lg bg-muted/50 px-3 py-2 text-sm leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SummaryTab({ analysis }: { analysis: MeetingAnalysis | null }) {
  if (!analysis || !analysis.summary) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title="Henüz özet oluşturulmadı"
        description="Bu toplantı için bir özet bulunmuyor. Döküm hazır olduğunda otomatik oluşturulur."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {analysis.source === "fallback" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Bu özet <strong>yerel bir çıkarım yöntemiyle</strong> oluşturuldu (AI modeli
            kullanılmadı). Bir yapay zeka özetinin kalitesini yansıtmayabilir.
          </p>
        </div>
      )}

      <Card className="p-5">
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Yönetici Özeti</h3>
        <p className="leading-relaxed">{analysis.summary}</p>
      </Card>

      <Section icon={<ListChecks className="h-4 w-4" />} title="Ana Konular" items={analysis.topics} />
      <Section icon={<ListTodo className="h-4 w-4" />} title="Kararlar" items={analysis.decisions} />
      <Section icon={<ShieldAlert className="h-4 w-4" />} title="Riskler" items={analysis.risks} />
      <Section
        icon={<CircleHelp className="h-4 w-4" />}
        title="Çözümlenmemiş Sorular"
        items={analysis.unresolved_questions}
      />
      <Section icon={<Sparkles className="h-4 w-4" />} title="Takip Edilecekler" items={analysis.follow_ups} />
    </div>
  );
}
