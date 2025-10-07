import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const shiftData = [
  { shift: "Shift A", breakdowns: 12, downtime: 420 },
  { shift: "Shift B", breakdowns: 8, downtime: 280 },
  { shift: "Shift C", breakdowns: 4, downtime: 150 }
];

const topMachinesData = [
  { machine: "CNC-101", downtime: 240 },
  { machine: "LATHE-205", downtime: 180 },
  { machine: "MILL-330", downtime: 145 },
  { machine: "DRILL-412", downtime: 120 },
  { machine: "PRESS-508", downtime: 95 }
];

export default function DashboardCharts() {
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
