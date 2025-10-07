import { Badge } from "@/components/ui/badge";

interface BreakdownStatusBadgeProps {
  status: "open" | "closed" | "pending";
}

export default function BreakdownStatusBadge({ status }: BreakdownStatusBadgeProps) {
  const config = {
    open: {
      label: "Open",
      className: "bg-destructive text-destructive-foreground"
    },
    closed: {
      label: "Closed",
      className: "bg-success text-success-foreground"
    },
    pending: {
      label: "Pending",
      className: "bg-warning text-warning-foreground"
    }
  };

  const { label, className } = config[status];

  return (
    <Badge 
      className={`text-xs font-semibold uppercase ${className}`}
      data-testid={`badge-status-${status}`}
    >
      {label}
    </Badge>
  );
}
