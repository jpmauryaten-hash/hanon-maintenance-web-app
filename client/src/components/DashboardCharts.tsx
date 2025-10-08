import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface DashboardChartsProps {
  breakdowns: any[];
}

export default function DashboardCharts({ breakdowns }: DashboardChartsProps) {
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });

  const shiftData = useMemo(() => {
    const shiftMap = new Map<string, { shift: string; breakdowns: number; downtime: number }>();
    
    breakdowns.forEach(breakdown => {
      const shift = `Shift ${breakdown.shift}`;
      const existing = shiftMap.get(shift) || { shift, breakdowns: 0, downtime: 0 };
      existing.breakdowns += 1;
      existing.downtime += parseInt(breakdown.totalMinutes) || 0;
      shiftMap.set(shift, existing);
    });

    return Array.from(shiftMap.values()).sort((a, b) => a.shift.localeCompare(b.shift));
  }, [breakdowns]);

  const topMachinesData = useMemo(() => {
    const machineMap = new Map<string, number>();
    
    breakdowns.forEach(breakdown => {
      const machineId = breakdown.machineId;
      const downtime = parseInt(breakdown.totalMinutes) || 0;
      machineMap.set(machineId, (machineMap.get(machineId) || 0) + downtime);
    });

    const machineEntries = Array.from(machineMap.entries())
      .map(([machineId, downtime]) => {
        const machine = machines.find(m => m.id === machineId);
        return {
          machine: machine?.name || 'Unknown',
          downtime
        };
      })
      .sort((a, b) => b.downtime - a.downtime)
      .slice(0, 5);

    return machineEntries;
  }, [breakdowns, machines]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Shift-wise Breakdown Analysis</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={shiftData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="shift" className="text-xs" />
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
            <YAxis dataKey="machine" type="category" className="text-xs" width={80} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Bar dataKey="downtime" fill="hsl(var(--chart-3))" name="Downtime (min)" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
