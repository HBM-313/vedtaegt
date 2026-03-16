import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MeetingStatus = "draft" | "active" | "pending_approval" | "approved";

const statusConfig: Record<MeetingStatus, { label: string; className: string }> = {
  draft: {
    label: "Kladde",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  active: {
    label: "Aktivt",
    className: "bg-primary/10 text-primary border-transparent",
  },
  pending_approval: {
    label: "Afventer godkendelse",
    className: "bg-yellow-100 text-yellow-800 border-transparent dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  approved: {
    label: "Godkendt",
    className: "bg-green-100 text-green-800 border-transparent dark:bg-green-900/30 dark:text-green-400",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[(status as MeetingStatus)] || statusConfig.draft;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
