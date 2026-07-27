"use client";

import { useCallback, useRef, useState } from "react";
import { FileAudio, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ALLOWED_MEDIA_EXTENSIONS, MAX_UPLOAD_MB, validateMediaFile } from "@/lib/validation";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPanel({
  onFileSelected,
  selectedFile,
  uploadProgress,
}: {
  onFileSelected: (file: File | null) => void;
  selectedFile: File | null;
  uploadProgress: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = useCallback(
    (file: File) => {
      const result = validateMediaFile(file);
      if (!result.ok) {
        setError(result.error ?? "Dosya kabul edilemedi.");
        return;
      }
      setError(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSet(file);
  }

  if (selectedFile) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <FileAudio className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">{formatBytes(selectedFile.size)}</p>
          </div>
          {uploadProgress === null && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onFileSelected(null)}
              aria-label="Seçili dosyayı kaldır"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {uploadProgress !== null && (
          <div className="flex flex-col gap-1">
            <Progress value={uploadProgress} />
            <p className="text-xs text-muted-foreground">Yükleniyor... %{uploadProgress}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Ses veya video dosyası seçmek için tıklayın ya da sürükleyip bırakın"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          isDragging ? "border-primary bg-accent" : "border-muted-foreground/25 hover:border-primary/40"
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-medium">Dosyayı buraya sürükleyin veya seçin</p>
          <p className="mt-1 text-sm text-muted-foreground">
            MP3, WAV, M4A, MP4, WebM, OGG — maksimum {MAX_UPLOAD_MB} MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MEDIA_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) validateAndSet(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Dosya kabul edilemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
