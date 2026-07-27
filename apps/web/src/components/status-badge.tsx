import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MeetingStatus } from "@/lib/types";

const STATUS_CONFIG: Record<MeetingStatus, { label: string; className: string }> = {
  uploaded: { label: "Yüklendi", className: "bg-muted text-muted-foreground" },
  processing: { label: "İşleniyor", className: "bg-accent text-accent-foreground motion-safe:animate-pulse" },
  transcribed: { label: "Döküm Hazır", className: "bg-accent text-accent-foreground" },
  ready: { label: "Hazır", className: "bg-primary/15 text-primary" },
  error: { label: "Başarısız", className: "bg-destructive/15 text-destructive" },
};

export function StatusBadge({ status, className }: { status: MeetingStatus; className?: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.uploaded;
  return (
    <Badge variant="secondary" className={cn(config.className, "font-medium", className)}>
      {config.label}
    </Badge>
  );
}
