import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  // contract statuses
  invitation: { label: "Invitation sent", variant: "secondary" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "destructive" },
  appointed: { label: "Appointed", variant: "default" },
  complete: { label: "Complete", variant: "success" },
  // event statuses
  draft: { label: "Draft", variant: "outline" },
  published: { label: "Published", variant: "default" },
  completed: { label: "Completed", variant: "success" },
  // shared / membership statuses
  cancelled: { label: "Cancelled", variant: "destructive" },
  pending: { label: "Pending", variant: "warning" },
  active: { label: "Active", variant: "success" },
  removed: { label: "Removed", variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
