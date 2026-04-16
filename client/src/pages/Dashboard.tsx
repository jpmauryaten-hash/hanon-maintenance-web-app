import DashboardMetricCard from "@/components/DashboardMetricCard";
import DashboardCharts from "@/components/DashboardCharts";
import BreakdownTable from "@/components/BreakdownTable";
import { Activity, Clock, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Dashboard() {
  const [selectedMachine, setSelectedMachine] = useState<{ id: string; name: string } | null>(null);
  const { data: machines = [] } = useQuery<any[]>({
    queryKey: ["/api/machines"],
  });

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [rangeInput, setRangeInput] = useState({ start: todayIso, end: todayIso });
  const [appliedRange, setAppliedRange] = useState({ start: todayIso, end: todayIso });

  const activeRangeStart = appliedRange.start;
  const activeRangeEnd = appliedRange.end;
  const activeRangeLabel = `${activeRangeStart} -> ${activeRangeEnd}`;

  const applyDateRange = () => {
    const start = rangeInput.start || todayIso;
    const end = rangeInput.end || start;
    if (start > end) {
      setAppliedRange({ start: end, end: start });
      return;
    }
    setAppliedRange({ start, end });
  };

  const { data: breakdownResponse, isLoading, isFetching } = useQuery<any>({
    queryKey: ["/api/breakdowns/dashboard", activeRangeStart, activeRangeEnd],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("startDate", activeRangeStart);
      params.set("endDate", activeRangeEnd);
      params.set("page", "1");
      params.set("pageSize", "10000");
      const res = await apiRequest("GET", `/api/breakdowns?${params.toString()}`);
      return res.json();
    },
  });

  const breakdowns = useMemo(() => {
    if (Array.isArray(breakdownResponse)) {
      return breakdownResponse;
    }
    if (breakdownResponse?.items && Array.isArray(breakdownResponse.items)) {
      return breakdownResponse.items;
    }
    return [];
  }, [breakdownResponse]);

  const filteredBreakdowns = useMemo(() => {
    return breakdowns;
  }, [breakdowns]);

  const totalDowntimeMinutes = useMemo(() => {
    return filteredBreakdowns.reduce((sum, b) => {
      return sum + (parseInt(b.totalMinutes) || 0);
    }, 0);
  }, [filteredBreakdowns]);

  const metrics = useMemo(() => {
    const totalBreakdowns = filteredBreakdowns.length;
    const totalDowntimeHours = Math.round(totalDowntimeMinutes / 60);
    const openIssues = filteredBreakdowns.filter((b) => b.status === "open").length;
    const today = new Date().toISOString().split("T")[0];
    const resolvedToday = filteredBreakdowns.filter(
      (b) => b.status === "closed" && b.date === today,
    ).length;

    return {
      totalBreakdowns,
      totalDowntimeMinutes,
      totalDowntimeHours,
      openIssues,
      resolvedToday,
    };
  }, [filteredBreakdowns, totalDowntimeMinutes]);

  const availabilitySummary = useMemo(() => {
    const totalMachines = machines.length;
    const perDayAvailableHours = 24;
    const totalMachineAvailableHoursPerDay = perDayAvailableHours * totalMachines;
    return {
      totalMachines,
      perDayAvailableHours,
      totalMachineAvailableHoursPerDay,
      totalMachineAvailableHoursMonthly: totalMachineAvailableHoursPerDay * totalMachines,
      weeklyAvailableHours: totalMachineAvailableHoursPerDay * 7,
      monthlyAvailableHours: totalMachineAvailableHoursPerDay * 26,
      weeklyAvailableAfterBd:
        totalMachineAvailableHoursPerDay * 7 - totalDowntimeMinutes / 60,
      monthlyAvailableAfterBd:
        totalMachineAvailableHoursPerDay * 26 - totalDowntimeMinutes / 60,
    };
  }, [machines.length, totalDowntimeMinutes]);

  const performanceSummary = useMemo(() => {
    const totalBreakdowns = metrics.totalBreakdowns;
    const totalDowntimeHours = totalDowntimeMinutes / 60;
    const mttr = totalBreakdowns > 0 ? totalDowntimeHours / totalBreakdowns : 0;
    const mtbfHours =
      totalBreakdowns > 0 ? availabilitySummary.weeklyAvailableAfterBd / totalBreakdowns : 0;
    const mtbfDays = mtbfHours / 21.5;
    const availabilityPercent =
      availabilitySummary.monthlyAvailableHours > 0
        ? (availabilitySummary.monthlyAvailableAfterBd / availabilitySummary.monthlyAvailableHours) *
          100
        : 0;

    return {
      mttr,
      mtbfHours,
      mtbfDays,
      availabilityPercent,
    };
  }, [availabilitySummary, metrics.totalBreakdowns, totalDowntimeMinutes]);

  const weeklyBreakdownSummary = useMemo(() => {
    const rangeStart = parseISO(activeRangeStart);
    const rangeEnd = parseISO(activeRangeEnd);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      return Array.from({ length: 4 }, () => ({
        count: 0,
        minutes: 0,
        hours: 0,
        mttr: 0,
        mtbf: 0,
        availability: 0,
      }));
    }

    const weeklySlots = Array.from({ length: 4 }, () => ({
      count: 0,
      minutes: 0,
    }));

    for (const breakdown of breakdowns) {
      if (!breakdown?.date) continue;
      const parsed = parseISO(String(breakdown.date));
      if (Number.isNaN(parsed.getTime())) continue;
      if (parsed < rangeStart || parsed > rangeEnd) continue;

      const diffDays = Math.floor((parsed.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.min(3, Math.floor(diffDays / 7));
      const minutes = parseInt(breakdown.totalMinutes) || 0;
      weeklySlots[weekIndex].count += 1;
      weeklySlots[weekIndex].minutes += minutes;
    }

    const weeklyAvailableHours = availabilitySummary.totalMachineAvailableHoursPerDay * 7;

    return weeklySlots.map((slot) => {
      const hours = slot.minutes / 60;
      const mttr = slot.count > 0 ? slot.minutes / slot.count : 0;
      const weeklyAfterBd = weeklyAvailableHours - hours;
      const mtbf = slot.count > 0 ? weeklyAfterBd / slot.count : 0;
      const availability =
        weeklyAvailableHours > 0 ? (weeklyAfterBd / weeklyAvailableHours) * 100 : 0;

      return {
        count: slot.count,
        minutes: slot.minutes,
        hours,
        mttr,
        mtbf,
        availability,
      };
    });
  }, [activeRangeEnd, activeRangeStart, availabilitySummary.totalMachineAvailableHoursPerDay, breakdowns]);

  const recentBreakdowns = useMemo(() => {
    return [...filteredBreakdowns]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [filteredBreakdowns]);

  const selectedMachineBreakdowns = useMemo(() => {
    if (!selectedMachine) {
      return [];
    }
    return filteredBreakdowns.filter((breakdown) => breakdown.machineId === selectedMachine.id);
  }, [filteredBreakdowns, selectedMachine]);

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

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="filter-start">Start Date</Label>
            <Input
              id="filter-start"
              type="date"
              value={rangeInput.start}
              max={rangeInput.end || undefined}
              onChange={(e) =>
                setRangeInput((prev) => ({
                  ...prev,
                  start: e.target.value || todayIso,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-end">End Date</Label>
            <Input
              id="filter-end"
              type="date"
              value={rangeInput.end}
              min={rangeInput.start || undefined}
              onChange={(e) =>
                setRangeInput((prev) => ({
                  ...prev,
                  end: e.target.value || prev.start,
                }))
              }
            />
          </div>
          <Button className="min-w-24" onClick={applyDateRange} disabled={isFetching}>
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading
              </>
            ) : (
              "Go"
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          Active range: <span className="font-medium text-foreground">{activeRangeLabel}</span>
          {isFetching ? <span className="ml-2">Fetching data...</span> : null}
        </div>
      </Card>

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

      <div className="flex flex-col gap-4 md:flex-row">
        <Card className="p-4 w-full md:w-1/3">
          <h2 className="text-lg font-semibold mb-3">Breakdown Summary</h2>
          <Table>
          <TableBody>
            <TableRow className="bg-muted/20">
              <TableCell>Total BD time</TableCell>
              <TableCell className="text-right font-medium">{metrics.totalDowntimeMinutes} Min</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Total BD time</TableCell>
              <TableCell className="text-right font-medium">
                {(metrics.totalDowntimeMinutes / 60).toFixed(2)} Hours
              </TableCell>
            </TableRow>
            <TableRow className="bg-muted/20">
              <TableCell>Total No. Of BD</TableCell>
              <TableCell className="text-right font-medium">{metrics.totalBreakdowns} Number</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Total No Machine</TableCell>
              <TableCell className="text-right font-medium">{availabilitySummary.totalMachines} Number</TableCell>
            </TableRow>
            <TableRow className="bg-muted/20">
              <TableCell>Per Day available Time</TableCell>
              <TableCell className="text-right font-medium">
                {availabilitySummary.perDayAvailableHours} Hours
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Total Machine Available Time</TableCell>
              <TableCell className="text-right font-medium">
                {availabilitySummary.totalMachineAvailableHoursPerDay} Hours/day
              </TableCell>
            </TableRow>
            <TableRow className="bg-muted/20">
              <TableCell>Total Machine Available Time</TableCell>
              <TableCell className="text-right font-medium">
                {availabilitySummary.totalMachineAvailableHoursMonthly} Hours/Monthly
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Weekly available time</TableCell>
              <TableCell className="text-right font-medium">
                {availabilitySummary.weeklyAvailableHours} Hours
              </TableCell>
            </TableRow>
            <TableRow className="bg-muted/20">
              <TableCell>Monthly available time</TableCell>
              <TableCell className="text-right font-medium">
                {availabilitySummary.monthlyAvailableHours} Hours
              </TableCell>
            </TableRow>

          </TableBody>
          </Table>
        </Card>

        <Card className="p-4 w-full md:w-1/3">
          <h2 className="text-lg font-semibold mb-3">Performance Summary</h2>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Weekly available time After BD</TableCell>
                <TableCell className="text-right font-medium">
                  {availabilitySummary.weeklyAvailableAfterBd.toFixed(2)} Hours
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/20">
                <TableCell>Monthly available time After BD</TableCell>
                <TableCell className="text-right font-medium">
                  {availabilitySummary.monthlyAvailableAfterBd.toFixed(2)} Hours
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/20">
                <TableCell>MTTR</TableCell>
                <TableCell className="text-right font-medium">
                  {performanceSummary.mttr.toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>MTBF (Hours)</TableCell>
                <TableCell className="text-right font-medium">
                  {performanceSummary.mtbfHours.toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/20">
                <TableCell>MTBF (Days)</TableCell>
                <TableCell className="text-right font-medium">
                  {performanceSummary.mtbfDays.toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Availability</TableCell>
                <TableCell className="text-right font-medium">
                  {performanceSummary.availabilityPercent.toFixed(2)}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4 w-full md:w-1/3">
          <h2 className="text-lg font-semibold mb-3">Weekly Breakdown Summary</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicator</TableHead>
                {[1, 2, 3, 4].map((week) => (
                  <TableHead key={week} className="text-right">{`Week-${week}`}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/20">
                <TableCell>No. of BD</TableCell>
                {weeklyBreakdownSummary.map((week, index) => (
                  <TableCell key={index} className="text-right font-medium">
                    {week.count}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>BD time In Min.</TableCell>
                {weeklyBreakdownSummary.map((week, index) => (
                  <TableCell key={index} className="text-right font-medium">
                    {week.minutes}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="bg-muted/20">
                <TableCell>BD time In Hours</TableCell>
                {weeklyBreakdownSummary.map((week, index) => (
                  <TableCell key={index} className="text-right font-medium">
                    {week.hours.toFixed(1)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>MTTR</TableCell>
                {weeklyBreakdownSummary.map((week, index) => (
                  <TableCell key={index} className="text-right font-medium">
                    {week.mttr.toFixed(1)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="bg-muted/20">
                <TableCell>MTBF</TableCell>
                {weeklyBreakdownSummary.map((week, index) => (
                  <TableCell key={index} className="text-right font-medium">
                    {week.mtbf.toFixed(1)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Availability</TableCell>
                {weeklyBreakdownSummary.map((week, index) => (
                  <TableCell key={index} className="text-right font-medium">
                    {week.availability.toFixed(1)}%
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="bg-muted/20">
                <TableCell>R&amp;M Cost</TableCell>
                {weeklyBreakdownSummary.map((_, index) => (
                  <TableCell key={index} className="text-right font-medium">
                    -
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>

      <DashboardCharts
        breakdowns={filteredBreakdowns}
        onTopMachineClick={(machine) => setSelectedMachine(machine)}
      />

      <Dialog open={!!selectedMachine} onOpenChange={(open) => !open && setSelectedMachine(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Top Machine Details - {selectedMachine?.name || "Machine"}
            </DialogTitle>
          </DialogHeader>
          <BreakdownTable breakdowns={selectedMachineBreakdowns} canEdit={false} />
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <h2 className="text-xl font-medium">Recent Breakdowns</h2>
        <BreakdownTable breakdowns={recentBreakdowns} canEdit={false} />
      </div>
    </div>
  );
}
