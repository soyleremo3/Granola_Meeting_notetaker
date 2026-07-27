"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { formatTimestamp } from "@/lib/format";
import { api } from "@/lib/api";
import type { TranscriptSegment } from "@/lib/types";

export function TranscriptTab({
  meetingId,
  segments,
  hasAudio,
}: {
  meetingId: string;
  segments: TranscriptSegment[];
  hasAudio: boolean;
}) {
  const [search, setSearch] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return segments;
    const q = search.trim().toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, search]);

  function seekTo(seconds: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play().catch(() => {});
    }
  }

  function copyTranscript() {
    const text = segments.map((s) => `[${formatTimestamp(s.start_time)}] ${s.text}`).join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast.success("Konuşma metni kopyalandı"),
      () => toast.error("Kopyalama başarısız oldu")
    );
  }

  if (segments.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title="Henüz döküm yok"
        description="Bu toplantı için konuşma metni bulunmuyor."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Konuşmacı ayrımı (diarization) bu sürümde etkin değildir; bölümler zaman damgasına göre
        listelenir.
      </p>

      {hasAudio && (
        <audio ref={audioRef} controls src={api.audioUrl(meetingId)} className="w-full">
          Tarayıcınız ses oynatmayı desteklemiyor.
        </audio>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Döküm içinde ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={copyTranscript}>
          <Copy className="h-4 w-4" />
          Kopyala
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aramanızla eşleşen bölüm bulunamadı.</p>
      ) : (
        <div className="flex flex-col divide-y rounded-xl border">
          {filtered.map((segment) => (
            <div key={segment.id} className="flex gap-3 p-3">
              <button
                onClick={() => seekTo(segment.start_time)}
                disabled={!hasAudio}
                className="h-fit shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-default disabled:hover:bg-muted"
              >
                {formatTimestamp(segment.start_time)}
              </button>
              <p className="text-sm leading-relaxed">{segment.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
