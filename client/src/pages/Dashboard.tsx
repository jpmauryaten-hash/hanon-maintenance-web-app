import DashboardMetricCard from "@/components/DashboardMetricCard";
import DashboardCharts from "@/components/DashboardCharts";
import BreakdownTable from "@/components/BreakdownTable";
import { Activity, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export default function Dashboard() {
  const { data: breakdowns = [], isLoading } = useQuery<any[]>({ 
    queryKey: ["/api/breakdowns"] 
  });

  const metrics = useMemo(() => {
    const totalBreakdowns = breakdowns.length;
    
    const totalDowntimeMinutes = breakdowns.reduce((sum, b) => {
      return sum + (parseInt(b.totalMinutes) || 0);
    }, 0);
    const totalDowntimeHours = Math.round(totalDowntimeMinutes / 60);
    
    const openIssues = breakdowns.filter(b => b.status === 'Open').length;
    
    const today = new Date().toISOString().split('T')[0];
    const resolvedToday = breakdowns.filter(
      b => b.status === 'Closed' && b.date === today
    ).length;

    return {
      totalBreakdowns,
      totalDowntimeHours,
      openIssues,
      resolvedToday
    };
  }, [breakdowns]);

  const recentBreakdowns = useMemo(() => {
    return [...breakdowns]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [breakdowns]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of breakdown metrics and analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardMetricCard
          title="Total Breakdowns"
          value={metrics.totalBreakdowns.toString()}
          icon={Activity}
          data-testid="metric-total-breakdowns"
        />
        <DashboardMetricCard
          title="Total Downtime"
          value={`${metrics.totalDowntimeHours}h`}
          icon={Clock}
          data-testid="metric-total-downtime"
        />
        <DashboardMetricCard
          title="Open Issues"
          value={metrics.openIssues.toString()}
          icon={AlertTriangle}
          data-testid="metric-open-issues"
        />
        <DashboardMetricCard
          title="Resolved Today"
          value={metrics.resolvedToday.toString()}
          icon={CheckCircle}
          data-testid="metric-resolved-today"
        />
      </div>

      <DashboardCharts breakdowns={breakdowns} />

      <div className="space-y-4">
        <h2 className="text-xl font-medium">Recent Breakdowns</h2>
        <BreakdownTable breakdowns={recentBreakdowns} canEdit={false} />
      </div>
    </div>
  );
}
