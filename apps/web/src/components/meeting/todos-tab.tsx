"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ListTodo, Pencil, Plus, Trash2, User, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ActionItem, Priority } from "@/lib/types";

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  high: { label: "Yüksek", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  medium: {
    label: "Orta",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  low: { label: "Düşük", className: "bg-muted text-muted-foreground" },
};

interface EditDraft {
  description: string;
  assignee: string;
  due_date: string;
  priority: Priority;
}

export function TodosTab({
  meetingId,
  items,
  onChanged,
}: {
  meetingId: string;
  items: ActionItem[];
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "completed">("all");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = items.filter((i) => {
    if (filter === "open") return !i.is_completed;
    if (filter === "completed") return i.is_completed;
    return true;
  });

  async function toggleComplete(item: ActionItem) {
    try {
      await api.updateActionItem(meetingId, item.id, { is_completed: !item.is_completed });
      onChanged();
    } catch (err) {
      toast.error("Görev güncellenemedi", { description: err instanceof ApiError ? err.message : undefined });
    }
  }

  async function deleteItem(item: ActionItem) {
    try {
      await api.deleteActionItem(meetingId, item.id);
      onChanged();
    } catch (err) {
      toast.error("Görev silinemedi", { description: err instanceof ApiError ? err.message : undefined });
    }
  }

  async function addItem() {
    const description = newDescription.trim();
    if (!description) return;
    setAdding(true);
    try {
      await api.createActionItem(meetingId, { description, priority: "medium" });
      setNewDescription("");
      onChanged();
    } catch (err) {
      toast.error("Görev eklenemedi", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setAdding(false);
    }
  }

  function startEdit(item: ActionItem) {
    setEditingId(item.id);
    setDraft({
      description: item.description,
      assignee: item.assignee ?? "",
      due_date: item.due_date ?? "",
      priority: item.priority,
    });
  }

  async function saveEdit(item: ActionItem) {
    if (!draft) return;
    const description = draft.description.trim();
    if (!description) {
      toast.error("Görev açıklaması boş olamaz.");
      return;
    }
    setSaving(true);
    try {
      await api.updateActionItem(meetingId, item.id, {
        description,
        assignee: draft.assignee.trim() || null,
        due_date: draft.due_date.trim() || null,
        priority: draft.priority,
      });
      setEditingId(null);
      setDraft(null);
      onChanged();
    } catch (err) {
      toast.error("Görev güncellenemedi", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Yeni görev ekle..."
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          disabled={adding}
        />
        <Button onClick={addItem} disabled={adding || !newDescription.trim()}>
          <Plus className="h-4 w-4" />
          Ekle
        </Button>
      </div>

      <div className="flex gap-1" role="group" aria-label="Görevleri filtrele">
        {(["all", "open", "completed"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {key === "all" ? "Tümü" : key === "open" ? "Açık" : "Tamamlanan"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-8 w-8" />}
          title={items.length === 0 ? "Henüz görev yok" : "Bu filtreye uyan görev yok"}
          description={items.length === 0 ? "AI analiz tamamlandığında görevler burada listelenir." : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3",
                  item.is_completed && !isEditing && "opacity-60"
                )}
              >
                <Checkbox
                  checked={item.is_completed}
                  onCheckedChange={() => toggleComplete(item)}
                  className="mt-0.5"
                  disabled={isEditing}
                  aria-label={
                    item.is_completed
                      ? `"${item.description}" görevini yeniden aç`
                      : `"${item.description}" görevini tamamlandı işaretle`
                  }
                />
                <div className="min-w-0 flex-1">
                  {isEditing && draft ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        placeholder="Görev açıklaması"
                        disabled={saving}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Input
                          value={draft.assignee}
                          onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}
                          placeholder="Sorumlu (opsiyonel)"
                          className="w-40"
                          disabled={saving}
                        />
                        <Input
                          value={draft.due_date}
                          onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                          placeholder="Tarih (opsiyonel)"
                          className="w-40"
                          disabled={saving}
                        />
                        <Select
                          value={draft.priority}
                          onValueChange={(v) => setDraft({ ...draft, priority: v as Priority })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Düşük</SelectItem>
                            <SelectItem value="medium">Orta</SelectItem>
                            <SelectItem value="high">Yüksek</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={cn("text-sm leading-relaxed", item.is_completed && "line-through")}>
                        {item.description}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={PRIORITY_CONFIG[item.priority].className}>
                          {PRIORITY_CONFIG[item.priority].label}
                        </Badge>
                        {item.assignee && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {item.assignee}
                          </span>
                        )}
                        {item.due_date && (
                          <span className="text-xs text-muted-foreground">{item.due_date}</span>
                        )}
                        {item.source === "ai" && (
                          <span className="text-xs text-muted-foreground">AI önerisi</span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => saveEdit(item)}
                        disabled={saving}
                        aria-label="Değişiklikleri kaydet"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingId(null);
                          setDraft(null);
                        }}
                        disabled={saving}
                        aria-label="Düzenlemeyi iptal et"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(item)}
                        aria-label={`"${item.description}" görevini düzenle`}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteItem(item)}
                        aria-label={`"${item.description}" görevini sil`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
