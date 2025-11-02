import DashboardCharts from '../DashboardCharts';

const exampleBreakdowns = [
  {
    id: "bd-1",
    shift: "A",
    totalMinutes: "120",
    machineId: "machine-1",
  },
  {
    id: "bd-2",
    shift: "B",
    totalMinutes: "45",
    machineId: "machine-2",
  },
  {
    id: "bd-3",
    shift: "A",
    totalMinutes: "30",
    machineId: "machine-1",
  },
];

export default function DashboardChartsExample() {
  return (
    <div className="p-6">
      <DashboardCharts breakdowns={exampleBreakdowns} />
    </div>
  );
}
