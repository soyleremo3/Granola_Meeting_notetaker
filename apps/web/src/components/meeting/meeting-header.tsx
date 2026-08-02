"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Download, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/format";
import type { MeetingDetail } from "@/lib/types";

export function MeetingHeader({
  meeting,
  onUpdated,
}: {
  meeting: MeetingDetail;
  onUpdated: (meeting: MeetingDetail) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(meeting.title);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      toast.error("Başlık boş olamaz.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateMeeting(meeting.id, { title: trimmed });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      toast.error("Başlık güncellenemedi", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteMeeting(meeting.id);
      toast.success("Toplantı silindi");
      router.push("/dashboard/meetings");
    } catch (err) {
      setDeleting(false);
      toast.error("Toplantı silinemedi", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await api.regenerateAnalysis(meeting.id);
      toast.success("Analiz yeniden oluşturuluyor");
      router.refresh();
      window.location.reload();
    } catch (err) {
      toast.error("Analiz yeniden oluşturulamadı", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 border-b pb-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setTitleDraft(meeting.title);
                    setEditing(false);
                  }
                }}
                className="text-xl font-semibold"
                disabled={saving}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={saveTitle}
                disabled={saving}
                aria-label="Başlığı kaydet"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setTitleDraft(meeting.title);
                  setEditing(false);
                }}
                disabled={saving}
                aria-label="Başlık düzenlemeyi iptal et"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              aria-label={`Başlığı düzenle: ${meeting.title}`}
              className="group flex items-center gap-2 text-left text-2xl font-semibold tracking-tight"
            >
              <span className="truncate">{meeting.title}</span>
              <Pencil className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <StatusBadge status={meeting.status} />
            <span>{formatDate(meeting.created_at)}</span>
            <span>{formatDuration(meeting.duration_seconds)}</span>
            {meeting.is_demo && <span className="text-amber-600 dark:text-amber-500">Demo İçerik</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating || meeting.status === "processing" || meeting.status === "uploaded"}
          >
            <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
            Yeniden Analiz Et
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Download className="h-4 w-4" />
              Dışa Aktar
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<a href={api.exportUrl(meeting.id, "transcript", "txt")} download />}>
                Konuşma Metni (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href={api.exportUrl(meeting.id, "transcript", "md")} download />}>
                Konuşma Metni (.md)
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href={api.exportUrl(meeting.id, "notes", "md")} download />}>
                Toplantı Notları (.md)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Sil
          </Button>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplantıyı sil</DialogTitle>
            <DialogDescription>
              &quot;{meeting.title}&quot; adlı toplantı ve tüm ilişkili döküm, notlar ve görevler kalıcı
              olarak silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Siliniyor..." : "Evet, Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
