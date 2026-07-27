"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Circle, Mic, MonitorUp, Pause, Play, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  BROWSER_UNSUPPORTED_MESSAGE,
  getMediaStartErrorMessage,
  isMediaApiSupported,
  SHARING_ENDED_MESSAGE,
  SYSTEM_AUDIO_UNAVAILABLE_MESSAGE,
  type RecordingMode,
} from "@/lib/media-errors";
import {
  collectChunk,
  countTracks,
  createRecorder,
  mimeCandidatesForMode,
  NoVideoTrackError,
  pickSupportedMimeType,
  RecorderUnsupportedError,
  shouldStopRecorder,
  startRecorder,
} from "@/lib/media-recorder";

type RecordingState = "idle" | "requesting" | "recording" | "paused" | "stopped";

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function RecordPanel({
  onFinished,
}: {
  onFinished: (blob: Blob, mode: RecordingMode) => void;
}) {
  const [mode, setMode] = useState<RecordingMode>("screen");
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [noSystemAudio, setNoSystemAudio] = useState(false);
  const [sharingEndedNotice, setSharingEndedNotice] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef(0);
  const trackEndedListenerRef = useRef<{ track: MediaStreamTrack; handler: () => void } | null>(null);

  useEffect(() => {
    return () => {
      sessionIdRef.current += 1;
      removeTrackEndedListener();
      stopAllTracks();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (state === "recording" || state === "paused") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state]);

  function stopAllTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function removeTrackEndedListener() {
    const entry = trackEndedListenerRef.current;
    if (entry) {
      entry.track.removeEventListener("ended", entry.handler);
      trackEndedListenerRef.current = null;
    }
  }

  function tick() {
    setElapsedMs(Date.now() - startRef.current + pausedAccumRef.current);
  }

  async function startRecording() {
    // Guard against duplicate attempts while a previous request is already in flight
    // (e.g. the browser's share picker is still open).
    if (state !== "idle") return;

    setError(null);
    setNoSystemAudio(false);
    setSharingEndedNotice(false);

    if (typeof MediaRecorder === "undefined") {
      setError(getMediaStartErrorMessage(new RecorderUnsupportedError(), mode));
      return;
    }

    if (!isMediaApiSupported(mode, typeof navigator !== "undefined" ? navigator.mediaDevices : undefined)) {
      setError(BROWSER_UNSUPPORTED_MESSAGE);
      return;
    }

    setState("requesting");
    const sessionId = ++sessionIdRef.current;

    try {
      let stream: MediaStream;

      if (mode === "screen") {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

        const { video, audio } = countTracks(stream);
        if (video === 0) {
          stream.getTracks().forEach((t) => t.stop());
          throw new NoVideoTrackError();
        }
        if (audio === 0) setNoSystemAudio(true);

        const videoTrack = stream.getVideoTracks()[0];
        const handler = () => {
          if (sessionIdRef.current !== sessionId) return; // stale listener from a prior attempt
          setSharingEndedNotice(true);
          stopRecording();
        };
        videoTrack.addEventListener("ended", handler);
        trackEndedListenerRef.current = { track: videoTrack, handler };
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickSupportedMimeType(mimeCandidatesForMode(mode));
      const recorder = createRecorder(stream, mimeType);
      recorder.ondataavailable = (e) => {
        collectChunk(chunksRef.current, e.data);
      };
      recorder.onerror = (e) => {
        console.error("MediaRecorder error", (e as { error?: DOMException }).error ?? e);
      };
      recorder.onstop = () => {
        const fallbackType = mode === "screen" ? "video/webm" : "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || fallbackType });
        onFinished(blob, mode);
      };

      recorderRef.current = recorder;
      startRecorder(recorder, 1000);

      startRef.current = Date.now();
      pausedAccumRef.current = 0;
      setElapsedMs(0);
      intervalRef.current = setInterval(tick, 500);
      setState("recording");
    } catch (err) {
      removeTrackEndedListener();
      stopAllTracks();
      setState("idle");
      setError(getMediaStartErrorMessage(err, mode));
    }
  }

  function pauseRecording() {
    recorderRef.current?.pause();
    if (intervalRef.current) clearInterval(intervalRef.current);
    pausedAccumRef.current = elapsedMs;
    setState("paused");
  }

  function resumeRecording() {
    recorderRef.current?.resume();
    startRef.current = Date.now();
    intervalRef.current = setInterval(tick, 500);
    setState("recording");
  }

  function stopRecording() {
    // Check the recorder's own live state, not the React `state` variable: this function
    // is also invoked from a track "ended" listener closure created once at recording start,
    // which would otherwise always see the stale "idle" snapshot from that render.
    const recorder = recorderRef.current;
    if (!shouldStopRecorder(recorder)) return; // already stopped/stopping
    if (intervalRef.current) clearInterval(intervalRef.current);
    removeTrackEndedListener();
    recorder?.stop();
    stopAllTracks();
    setState("stopped");
  }

  function confirmCancelRecording() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    removeTrackEndedListener();
    const recorder = recorderRef.current;
    if (shouldStopRecorder(recorder) && recorder) {
      recorder.onstop = null;
      recorder.stop();
    }
    stopAllTracks();
    chunksRef.current = [];
    setElapsedMs(0);
    setSharingEndedNotice(false);
    setState("idle");
    setCancelConfirmOpen(false);
  }

  const isActive = state === "recording" || state === "paused";

  return (
    <div className="flex flex-col gap-5">
      {!isActive && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("screen")}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
              mode === "screen" ? "border-primary bg-accent" : "hover:border-primary/40"
            )}
          >
            <MonitorUp className="h-5 w-5 text-primary" />
            <span className="font-medium">Ekran/Sekme Sesi</span>
            <span className="text-sm text-muted-foreground">
              Google Meet veya Zoom sekmesini/penceresini paylaşın, toplantı sesini yakalar.
            </span>
            <span className="text-xs text-muted-foreground">
              Açılan pencerede Chrome Sekmesi&apos;ni seçin ve &quot;Sekme sesini paylaş&quot;
              kutusunu işaretleyin.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("microphone")}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
              mode === "microphone" ? "border-primary bg-accent" : "hover:border-primary/40"
            )}
          >
            <Mic className="h-5 w-5 text-primary" />
            <span className="font-medium">Yalnızca Mikrofon</span>
            <span className="text-sm text-muted-foreground">
              Sistem sesi paylaşımı desteklenmiyorsa mikrofonunuzdan kayıt alır.
            </span>
          </button>
        </div>
      )}

      {mode === "screen" && !isActive && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Paylaşırken dikkat edin</AlertTitle>
          <AlertDescription>
            Açılan pencerede toplantının geçtiği <strong>sekmeyi</strong> seçin ve{" "}
            <strong>&quot;Sekme sesini paylaş&quot;</strong> kutucuğunu işaretlediğinizden emin
            olun. Aksi halde toplantı sesi kaydedilmez.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Kayıt başlatılamadı</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {noSystemAudio && isActive && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sistem sesi algılanmadı</AlertTitle>
          <AlertDescription>{SYSTEM_AUDIO_UNAVAILABLE_MESSAGE}</AlertDescription>
        </Alert>
      )}

      {sharingEndedNotice && state === "stopped" && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Paylaşım sona erdi</AlertTitle>
          <AlertDescription>{SHARING_ENDED_MESSAGE}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card py-10">
        <div className="flex items-center gap-2">
          {isActive && (
            <Circle
              className={cn(
                "h-3 w-3 fill-red-500 text-red-500",
                state === "recording" && "animate-pulse"
              )}
            />
          )}
          <span className="font-mono text-3xl tabular-nums">{formatElapsed(elapsedMs)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {state === "idle" && "Kayda başlamak için hazır"}
          {state === "requesting" && "İzin isteniyor..."}
          {state === "recording" && "Kayıt yapılıyor"}
          {state === "paused" && "Kayıt duraklatıldı"}
          {state === "stopped" && "Kayıt tamamlandı, yükleniyor..."}
        </p>

        <div className="flex items-center gap-2">
          {state === "idle" && (
            <Button size="lg" onClick={startRecording}>
              <Circle className="h-4 w-4 fill-current" />
              Kaydı Başlat
            </Button>
          )}
          {state === "requesting" && (
            <Button size="lg" disabled>
              İzin bekleniyor...
            </Button>
          )}
          {state === "recording" && (
            <>
              <Button size="lg" variant="outline" onClick={pauseRecording}>
                <Pause className="h-4 w-4" />
                Duraklat
              </Button>
              <Button size="lg" variant="destructive" onClick={stopRecording}>
                <Square className="h-4 w-4" />
                Durdur
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setCancelConfirmOpen(true)}>
                <X className="h-4 w-4" />
                İptal
              </Button>
            </>
          )}
          {state === "paused" && (
            <>
              <Button size="lg" onClick={resumeRecording}>
                <Play className="h-4 w-4" />
                Devam Et
              </Button>
              <Button size="lg" variant="destructive" onClick={stopRecording}>
                <Square className="h-4 w-4" />
                Durdur
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setCancelConfirmOpen(true)}>
                <X className="h-4 w-4" />
                İptal
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kaydı iptal et</DialogTitle>
            <DialogDescription>
              Şu ana kadar kaydedilen ses ({formatElapsed(elapsedMs)}) kalıcı olarak silinecek ve
              kaydedilmeyecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelConfirmOpen(false)}>
              Kayda Devam Et
            </Button>
            <Button variant="destructive" onClick={confirmCancelRecording}>
              Evet, İptal Et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
