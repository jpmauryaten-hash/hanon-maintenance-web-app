import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface DashboardMetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

export default function DashboardMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  className = ""
}: DashboardMetricCardProps) {
  return (
    <Card className={`p-6 ${className}`} data-testid={`card-metric-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p className="text-3xl font-bold mt-2 font-mono" data-testid={`text-metric-${title.toLowerCase().replace(/\s/g, '-')}`}>
            {value}
          </p>
          {trend && (
            <p className={`text-sm mt-2 ${trend.positive ? 'text-success' : 'text-destructive'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className="p-3 bg-accent rounded-md">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </Card>
  );
}
