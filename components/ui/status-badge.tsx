import { STATUS_LABEL, type DisplayStatus } from "@/src/domain/types";
import { cn } from "./cn";

const tones: Record<DisplayStatus, string> = {
  pending: "text-warning",
  approved: "text-accent",
  checked_out: "text-accent",
  returned: "text-success",
  overdue: "text-danger",
  denied: "text-danger",
  cancelled: "text-muted",
};

export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border border-stroke bg-background px-2.5 py-1 text-xs font-medium", tones[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
