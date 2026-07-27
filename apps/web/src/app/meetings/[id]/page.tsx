"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingHeader } from "@/components/meeting/meeting-header";
import { ProcessingOverlay } from "@/components/meeting/processing-overlay";
import { SummaryTab } from "@/components/meeting/summary-tab";
import { TranscriptTab } from "@/components/meeting/transcript-tab";
import { TodosTab } from "@/components/meeting/todos-tab";
import { QaTab } from "@/components/meeting/qa-tab";
import { api, ApiError } from "@/lib/api";
import type { ActionItem, MeetingAnalysis, MeetingDetail, ProcessingStatus, TranscriptSegment } from "@/lib/types";

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const meetingId = params.id;

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadResults = useCallback(async () => {
    const [seg, an, items] = await Promise.all([
      api.getTranscript(meetingId),
      api.getAnalysis(meetingId),
      api.listActionItems(meetingId),
    ]);
    setSegments(seg);
    setAnalysis(an);
    setActionItems(items);
  }, [meetingId]);

  const loadMeeting = useCallback(async () => {
    try {
      const data = await api.getMeeting(meetingId);
      setMeeting(data);
      if (data.status === "ready" || data.status === "error") {
        if (data.status === "ready") await loadResults();
        else {
          const seg = await api.getTranscript(meetingId).catch(() => []);
          setSegments(seg);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
    }
  }, [meetingId, loadResults]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state updates happen after the await inside loadMeeting
    loadMeeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  useEffect(() => {
    if (!meeting) return;
    const isActive = meeting.status === "uploaded" || meeting.status === "processing";
    if (!isActive) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const s = await api.getStatus(meetingId);
        setStatus(s);
        if (s.status !== meeting.status) {
          const updated = await api.getMeeting(meetingId);
          setMeeting(updated);
          if (updated.status === "ready") {
            await loadResults();
            toast.success("Toplantı hazır", { description: "Notlar ve döküm hazırlandı." });
          }
        }
      } catch {
        // transient polling error, ignore and retry on next tick
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [meeting, meetingId, loadResults]);

  async function retryProcessing() {
    setRetrying(true);
    try {
      if (segments.length > 0) {
        await api.regenerateAnalysis(meetingId);
      } else {
        await api.startProcessing(meetingId);
      }
      const updated = await api.getMeeting(meetingId);
      setMeeting(updated);
    } catch (err) {
      toast.error("Yeniden deneme başarısız oldu", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setRetrying(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          <p className="text-lg font-medium">Toplantı bulunamadı</p>
          <p className="text-sm text-muted-foreground">Bu toplantı silinmiş veya hiç var olmamış olabilir.</p>
        </main>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="mt-4 h-64 w-full" />
        </main>
      </div>
    );
  }

  const isProcessing = meeting.status === "uploaded" || meeting.status === "processing";
  const isError = meeting.status === "error";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <MeetingHeader meeting={meeting} onUpdated={setMeeting} />

        {isProcessing && (
          <ProcessingOverlay
            status={
              status ?? { status: meeting.status, stage_label: "Bekleniyor", error_message: null }
            }
          />
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="font-medium">Bir hata oluştu</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {meeting.error_message || "İşlem sırasında beklenmeyen bir hata oluştu."}
            </p>
            <Button onClick={retryProcessing} disabled={retrying}>
              {retrying ? "Yeniden deneniyor..." : "Tekrar Dene"}
            </Button>
          </div>
        )}

        {!isProcessing && !isError && (
          <Tabs defaultValue="summary" className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary">Özet</TabsTrigger>
              <TabsTrigger value="transcript">Konuşma Metni</TabsTrigger>
              <TabsTrigger value="todos">Yapılacaklar</TabsTrigger>
              <TabsTrigger value="qa">Soru-Cevap</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-6">
              <SummaryTab analysis={analysis} />
            </TabsContent>

            <TabsContent value="transcript" className="mt-6">
              <TranscriptTab meetingId={meetingId} segments={segments} hasAudio={meeting.has_audio} />
            </TabsContent>

            <TabsContent value="todos" className="mt-6">
              <TodosTab meetingId={meetingId} items={actionItems} onChanged={loadResults} />
            </TabsContent>

            <TabsContent value="qa" className="mt-6">
              <QaTab meetingId={meetingId} hasTranscript={segments.length > 0} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
