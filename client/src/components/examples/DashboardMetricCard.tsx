import DashboardMetricCard from '../DashboardMetricCard';
import { Activity } from 'lucide-react';

export default function DashboardMetricCardExample() {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <DashboardMetricCard
        title="Total Breakdowns"
        value="24"
        icon={Activity}
        trend={{ value: "12% vs last month", positive: false }}
      />
      <DashboardMetricCard
        title="Total Downtime"
        value="156h"
        icon={Activity}
        trend={{ value: "8% vs last month", positive: true }}
      />
    </div>
  );
}
