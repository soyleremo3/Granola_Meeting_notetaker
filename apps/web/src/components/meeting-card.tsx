"use client";

import Link from "next/link";
import { CheckSquare, Clock, FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatDuration, formatRelativeDate } from "@/lib/format";
import type { MeetingSummary } from "@/lib/types";

export function MeetingCard({ meeting }: { meeting: MeetingSummary }) {
  return (
    <Link href={`/meetings/${meeting.id}`}>
      <Card className="group h-full gap-3 p-4 transition-colors hover:border-primary/50 hover:shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-medium leading-snug group-hover:text-primary">
            {meeting.title}
          </h3>
          <StatusBadge status={meeting.status} className="shrink-0" />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(meeting.duration_seconds)}
          </span>
          <span className="flex items-center gap-1">
            <CheckSquare className="h-3.5 w-3.5" />
            {meeting.open_action_item_count}/{meeting.action_item_count} açık görev
          </span>
          {meeting.is_demo && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
              <FlaskConical className="h-3.5 w-3.5" />
              Demo
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{formatRelativeDate(meeting.created_at)}</p>
      </Card>
    </Link>
  );
}
