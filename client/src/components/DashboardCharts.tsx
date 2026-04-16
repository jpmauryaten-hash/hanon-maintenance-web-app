import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

interface DashboardChartsProps {
  breakdowns: any[];
  onTopMachineClick?: (machine: { id: string; name: string }) => void;
}

export default function DashboardCharts({ breakdowns, onTopMachineClick }: DashboardChartsProps) {
  const lineData = useMemo(() => {
    const lineMap = new Map<string, { line: string; breakdowns: number; downtime: number }>();
    
    breakdowns.forEach(breakdown => {
      const line = breakdown.line || "Unknown";
      const existing = lineMap.get(line) || { line, breakdowns: 0, downtime: 0 };
      existing.breakdowns += 1;
      existing.downtime += parseInt(breakdown.totalMinutes) || 0;
      lineMap.set(line, existing);
    });

    return Array.from(lineMap.values()).sort((a, b) => a.line.localeCompare(b.line));
  }, [breakdowns]);

  const topMachinesData = useMemo(() => {
    const machineMap = new Map<string, { id: string; name: string; downtime: number }>();
    
    breakdowns.forEach(breakdown => {
      const machineId = breakdown.machineId || "unknown";
      const machineName = breakdown.machine || "Unknown";
      const downtime = parseInt(breakdown.totalMinutes) || 0;
      const existing = machineMap.get(machineId) || { id: machineId, name: machineName, downtime: 0 };
      existing.downtime += downtime;
      machineMap.set(machineId, existing);
    });

    const machineEntries = Array.from(machineMap.values())
      .sort((a, b) => b.downtime - a.downtime)
      .slice(0, 5);

    return machineEntries;
  }, [breakdowns]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Line-wise Breakdown Analysis</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="line" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Bar dataKey="breakdowns" fill="hsl(var(--chart-1))" name="Breakdowns" />
            <Bar dataKey="downtime" fill="hsl(var(--chart-2))" name="Downtime (min)" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Top 5 Machines by Downtime</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topMachinesData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" className="text-xs" />
            <YAxis dataKey="name" type="category" className="text-xs" width={100} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Bar
              dataKey="downtime"
              fill="hsl(var(--chart-3))"
              name="Downtime (min)"
              onClick={(data) => {
                if (!onTopMachineClick) return;
                const payload = data?.payload;
                if (!payload?.id) return;
                onTopMachineClick({ id: payload.id, name: payload.name });
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
