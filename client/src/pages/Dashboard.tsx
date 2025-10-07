import DashboardMetricCard from "@/components/DashboardMetricCard";
import DashboardCharts from "@/components/DashboardCharts";
import BreakdownTable from "@/components/BreakdownTable";
import { Activity, Clock, AlertTriangle, CheckCircle } from "lucide-react";

const mockBreakdowns = [
  {
    id: 1,
    date: '2025-10-07',
    shift: 'A',
    line: 'Line 1',
    machine: 'CNC-101',
    problem: 'Motor failure',
    status: 'open' as const,
    totalMinutes: 120,
    attendBy: 'John Doe'
  },
  {
    id: 2,
    date: '2025-10-07',
    shift: 'B',
    line: 'Line 2',
    machine: 'LATHE-205',
    problem: 'Belt broken',
    status: 'closed' as const,
    totalMinutes: 45,
    attendBy: 'Jane Smith'
  },
  {
    id: 3,
    date: '2025-10-06',
    shift: 'C',
    line: 'Line 1',
    machine: 'MILL-330',
    problem: 'Electrical issue',
    status: 'pending' as const,
    totalMinutes: 90,
    attendBy: 'Mike Johnson'
  }
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of breakdown metrics and analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardMetricCard
          title="Total Breakdowns"
          value="24"
          icon={Activity}
          trend={{ value: "12% vs last month", positive: false }}
        />
        <DashboardMetricCard
          title="Total Downtime"
          value="156h"
          icon={Clock}
          trend={{ value: "8% vs last month", positive: true }}
        />
        <DashboardMetricCard
          title="Open Issues"
          value="8"
          icon={AlertTriangle}
        />
        <DashboardMetricCard
          title="Resolved Today"
          value="12"
          icon={CheckCircle}
        />
      </div>

      <DashboardCharts />

      <div className="space-y-4">
        <h2 className="text-xl font-medium">Recent Breakdowns</h2>
        <BreakdownTable breakdowns={mockBreakdowns} canEdit={false} />
      </div>
    </div>
  );
}
