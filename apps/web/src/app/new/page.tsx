"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mic, Upload } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecordPanel } from "@/components/recording/record-panel";
import { UploadPanel } from "@/components/recording/upload-panel";
import { api, ApiError } from "@/lib/api";
import type { RecordingMode } from "@/lib/media-errors";

function NewMeetingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "record" ? "record" : searchParams.get("mode") === "upload" ? "upload" : "record";

  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<"record" | "upload">(initialMode);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitMedia(file: File, sourceType: "upload" | "recording") {
    setSubmitting(true);
    try {
      const meeting = await api.createMeeting({
        title: title.trim() || "Adsız Toplantı",
        source_type: sourceType,
        language: "tr",
      });

      setUploadProgress(0);
      await api.uploadMediaWithProgress(meeting.id, file, setUploadProgress);
      setUploadProgress(null);

      await api.startProcessing(meeting.id);
      toast.success("Toplantı işleniyor", { description: "Sonuçlar hazır olduğunda göreceksiniz." });
      router.push(`/meetings/${meeting.id}`);
    } catch (err) {
      setSubmitting(false);
      setUploadProgress(null);
      toast.error("Bir şeyler ters gitti", {
        description: err instanceof ApiError ? err.message : "Toplantı oluşturulamadı.",
      });
    }
  }

  function handleRecordingFinished(blob: Blob, mode: RecordingMode) {
    const fallbackType = mode === "screen" ? "video/webm" : "audio/webm";
    const file = new File([blob], `kayit-${Date.now()}.webm`, { type: blob.type || fallbackType });
    void submitMedia(file, "recording");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Yeni Toplantı</h1>
        <p className="mt-1 text-muted-foreground">
          Bir toplantıyı canlı kaydedin veya daha önce kaydedilmiş bir dosyayı yükleyin.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Label htmlFor="meeting-title">Toplantı Başlığı</Label>
          <Input
            id="meeting-title"
            placeholder="Örn. Haftalık Ürün Toplantısı"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "record" | "upload")} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="record" disabled={submitting}>
              <Mic className="h-4 w-4" />
              Kayıt Yap
            </TabsTrigger>
            <TabsTrigger value="upload" disabled={submitting}>
              <Upload className="h-4 w-4" />
              Dosya Yükle
            </TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="mt-6">
            {submitting ? (
              <SubmittingState progress={uploadProgress} />
            ) : (
              <RecordPanel onFinished={handleRecordingFinished} />
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-6">
            {submitting ? (
              <SubmittingState progress={uploadProgress} />
            ) : (
              <div className="flex flex-col gap-4">
                <UploadPanel
                  selectedFile={selectedFile}
                  onFileSelected={setSelectedFile}
                  uploadProgress={null}
                />
                <Button
                  size="lg"
                  disabled={!selectedFile}
                  onClick={() => selectedFile && submitMedia(selectedFile, "upload")}
                >
                  Yükle ve İşlemi Başlat
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function SubmittingState({ progress }: { progress: number | null }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="font-medium">
        {progress !== null ? `Dosya yükleniyor... %${progress}` : "Toplantı oluşturuluyor..."}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Yükleme tamamlandığında işleme sayfasına yönlendirileceksiniz.
      </p>
    </div>
  );
}

export default function NewMeetingPage() {
  return (
    <Suspense>
      <NewMeetingContent />
    </Suspense>
  );
}
