"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { MeetingCard } from "@/components/meeting-card";
import { api, ApiError } from "@/lib/api";
import type { MeetingSummary } from "@/lib/types";

export function MeetingList({
  limit,
  showControls = true,
  emptyAction,
}: {
  limit?: number;
  showControls?: boolean;
  emptyAction?: React.ReactNode;
}) {
  const [meetings, setMeetings] = useState<MeetingSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale error before a new debounced fetch
    setError(null);

    const timeout = setTimeout(() => {
      api
        .listMeetings({
          search: search || undefined,
          sort,
          status_filter: statusFilter === "all" ? undefined : statusFilter,
        })
        .then((data) => {
          if (!cancelled) setMeetings(data);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.message : "Toplantılar yüklenemedi.");
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, sort, statusFilter]);

  const visible = limit ? meetings?.slice(0, limit) : meetings;

  return (
    <div className="flex flex-col gap-4">
      {showControls && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Başlık veya içerikte ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sort} onValueChange={(v) => v && setSort(v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Sırala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">En Yeni</SelectItem>
              <SelectItem value="oldest">En Eski</SelectItem>
              <SelectItem value="duration">Süreye Göre</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="ready">Hazır</SelectItem>
              <SelectItem value="processing">İşleniyor</SelectItem>
              <SelectItem value="error">Hata</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {error && (
        <EmptyState
          icon={<CalendarClock className="h-8 w-8" />}
          title="Toplantılar yüklenemedi"
          description={error}
        />
      )}

      {!error && meetings === null && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: limit ?? 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {!error && meetings !== null && visible?.length === 0 && (
        <EmptyState
          icon={<CalendarClock className="h-8 w-8" />}
          title={search || statusFilter !== "all" ? "Sonuç bulunamadı" : "Henüz toplantı yok"}
          description={
            search || statusFilter !== "all"
              ? "Arama kriterlerinize uyan bir toplantı bulunamadı."
              : "İlk toplantınızı kaydedin veya bir ses dosyası yükleyerek başlayın."
          }
          action={emptyAction}
        />
      )}

      {!error && visible && visible.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  );
}
