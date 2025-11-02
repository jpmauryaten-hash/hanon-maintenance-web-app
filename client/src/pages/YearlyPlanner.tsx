import { ChangeEvent, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const MAINTENANCE_FREQUENCIES = ["Monthly", "Quarterly", "Half Yearly", "Yearly"];
const ALL_FREQUENCY_OPTION = "all";
const ALL_PLAN_YEAR_OPTION = "all-plan-year";

const YEARLY_PLAN_MONTHS = [
  { key: "jan", label: "JAN" },
  { key: "feb", label: "FEB" },
  { key: "mar", label: "MAR" },
  { key: "apr", label: "APR" },
  { key: "may", label: "MAY" },
  { key: "jun", label: "JUN" },
  { key: "jul", label: "JUL" },
  { key: "aug", label: "AUG" },
  { key: "sep", label: "SEP" },
  { key: "oct", label: "OCT" },
  { key: "nov", label: "NOV" },
  { key: "dec", label: "DEC" },
] as const;

type YearlyPlanMonthKey = (typeof YEARLY_PLAN_MONTHS)[number]["key"];
type YearlyPlanMonthRecord = Record<YearlyPlanMonthKey, string | null>;

interface MachineRecord {
  id: string;
  name: string;
  code?: string | null;
  maintenanceFrequency?: string | null;
  maintenance_frequency?: string | null;
  maintenancefrequency?: string | null;
  pmPlanYear?: string | null;
  pm_plan_year?: string | null;
  pmplanyear?: string | null;
}

interface YearlyMaintenancePlanApiRecord extends Partial<YearlyPlanMonthRecord> {
  id?: string;
  machineId: string;
  planYear: number;
  frequency?: string | null;
  machineName?: string | null;
  machineCode?: string | null;
}

const normalizeYearlyPlanFrequency = (value: string | null | undefined): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = MAINTENANCE_FREQUENCIES.find((option) => option.toLowerCase() === trimmed.toLowerCase());
  return match ?? "";
};

const resolveMachineCode = (machine: MachineRecord): string => {
  const candidates = [machine.code, (machine as any)?.machineCode, (machine as any)?.machine_code, (machine as any)?.machinecode];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return "";
};

const resolvePlanYear = (machine: MachineRecord): string => {
  const candidates = [machine.pmPlanYear, machine.pm_plan_year, machine.pmplanyear];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return "";
};

const parsePlanYearToMonths = (value: string): Set<YearlyPlanMonthKey> => {
  const months = new Set<YearlyPlanMonthKey>();
  if (!value) return months;

  const upper = value.toUpperCase();
  if (upper.includes("MONTHLY")) {
    for (const { key } of YEARLY_PLAN_MONTHS) months.add(key);
    return months;
  }

  const regex =
    /(JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEPT|SEP|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC)/gi;
  const tokens = Array.from(upper.matchAll(regex)).map((match) => match[0].slice(0, 3));
  const MONTH_SEQUENCE = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  for (const token of tokens) {
    const monthIndex = MONTH_SEQUENCE.indexOf(token);
    if (monthIndex !== -1) {
      months.add(YEARLY_PLAN_MONTHS[monthIndex].key);
    }
  }

  return months;
};

export default function YearlyPlanner(): JSX.Element {
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const { toast } = useToast();

  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [filters, setFilters] = useState({
    machineName: "",
    machineCode: "",
    frequency: ALL_FREQUENCY_OPTION,
    planYear: ALL_PLAN_YEAR_OPTION,
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery<MachineRecord[]>({
    queryKey: ["/api/machines"],
  });

  const normalizedYear = selectedYear.trim();
  const isYearQueryReady = normalizedYear.length === 4;
  const { data: yearlyPlans = [], isFetching: plansLoading } = useQuery<YearlyMaintenancePlanApiRecord[]>({
    queryKey: ["/api/yearly-maintenance-plans", normalizedYear || "__"],
    enabled: isYearQueryReady,
  });

  const planMonthSets = useMemo(() => {
    const map = new Map<string, Set<YearlyPlanMonthKey>>();
    for (const plan of yearlyPlans) {
      if (!plan?.machineId) continue;
      const monthSet = new Set<YearlyPlanMonthKey>();
      for (const { key } of YEARLY_PLAN_MONTHS) {
        const value = plan[key as keyof YearlyPlanMonthRecord];
        if (typeof value === "string" && value.trim().length > 0) {
          monthSet.add(key);
        }
      }
      if (monthSet.size > 0) {
        map.set(plan.machineId, monthSet);
      }
    }
    return map;
  }, [yearlyPlans]);

  const fallbackMonthSets = useMemo(() => {
    const map = new Map<string, Set<YearlyPlanMonthKey>>();
    for (const machine of machines) {
      map.set(machine.id, parsePlanYearToMonths(resolvePlanYear(machine)));
    }
    return map;
  }, [machines]);

  const frequencyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const machine of machines) {
      const frequency = normalizeYearlyPlanFrequency(
        machine.maintenanceFrequency ?? machine.maintenance_frequency ?? machine.maintenancefrequency,
      );
      if (frequency) {
        set.add(frequency);
      }
    }
    return Array.from(set).sort();
  }, [machines]);

  const planYearOptions = useMemo(() => {
    const set = new Set<string>();
    for (const machine of machines) {
      const planYear = resolvePlanYear(machine);
      if (planYear) {
        set.add(planYear);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [machines]);

  const visibleMachines = useMemo(() => {
    const nameFilter = filters.machineName.trim().toLowerCase();
    const codeFilter = filters.machineCode.trim().toLowerCase();
    const frequencyFilter = filters.frequency;
    const planYearFilter = filters.planYear;

    return machines.filter((machine) => {
      const machineName = (machine.name || "").toLowerCase();
      if (nameFilter && !machineName.includes(nameFilter)) {
        return false;
      }

      const machineCode = resolveMachineCode(machine).toLowerCase();
      if (codeFilter && !machineCode.includes(codeFilter)) {
        return false;
      }

      const normalizedFrequency = normalizeYearlyPlanFrequency(
        machine.maintenanceFrequency ?? machine.maintenance_frequency ?? machine.maintenancefrequency,
      );
      if (frequencyFilter !== ALL_FREQUENCY_OPTION && normalizedFrequency !== frequencyFilter) {
        return false;
      }

      if (planYearFilter !== ALL_PLAN_YEAR_OPTION) {
        const storedPlan = resolvePlanYear(machine).toLowerCase();
        if (!storedPlan.includes(planYearFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [filters, machines]);

  const handleYearChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 4);
    setSelectedYear(digitsOnly);
  }, []);

  const handleMonthClick = useCallback(
    (month: YearlyPlanMonthKey) => {
      if (!isYearQueryReady) {
        toast({
          title: "Enter a valid year",
          description: "Please enter a four-digit year before opening the monthly planner.",
          variant: "destructive",
        });
        return;
      }
      const url = `/yearly-planner/month/${month}?year=${normalizedYear}`;
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [isYearQueryReady, normalizedYear, toast],
  );

  const isBusy = machinesLoading || (isYearQueryReady && plansLoading);
  const totalColumns = YEARLY_PLAN_MONTHS.length + 5;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Yearly Maintenance Planner</h1>
        <p className="text-sm text-muted-foreground">
          Prepare and maintain the yearly preventive maintenance plan for every machine.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6">
          <div className="space-y-2">
            <Label htmlFor="yearly-plan-year">Plan Year</Label>
            <Input
              id="yearly-plan-year"
              value={selectedYear}
              onChange={handleYearChange}
              inputMode="numeric"
              maxLength={4}
              placeholder="Enter year (e.g. 2025)"
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-machine-name">Machine Name</Label>
            <Input
              id="filter-machine-name"
              value={filters.machineName}
              onChange={(event) => setFilters((prev) => ({ ...prev, machineName: event.target.value }))}
              placeholder="Search machine name"
              className="w-48"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-machine-code">Machine Code</Label>
            <Input
              id="filter-machine-code"
              value={filters.machineCode}
              onChange={(event) => setFilters((prev) => ({ ...prev, machineCode: event.target.value }))}
              placeholder="Search code"
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-frequency">Frequency</Label>
            <Select
              value={filters.frequency}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, frequency: value }))}
            >
              <SelectTrigger id="filter-frequency" className="w-44">
                <SelectValue placeholder="All frequencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All frequencies</SelectItem>
                {frequencyOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-plan-year">Plan Year</Label>
            <Select
              value={filters.planYear}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, planYear: value }))}
            >
              <SelectTrigger id="filter-plan-year" className="w-48">
                <SelectValue placeholder="All plan years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-plan-year">All plan years</SelectItem>
                {planYearOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold uppercase">Serial Number</TableHead>
                <TableHead className="text-xs font-semibold uppercase">Machine Name</TableHead>
                <TableHead className="text-xs font-semibold uppercase">Machine Code</TableHead>
                <TableHead className="text-xs font-semibold uppercase">Frequency</TableHead>
                <TableHead className="text-xs font-semibold uppercase">PM Plan Year</TableHead>
                {YEARLY_PLAN_MONTHS.map(({ key, label }) => (
                  <TableHead key={key} className="text-xs font-semibold uppercase">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isYearQueryReady ? (
                <TableRow>
                  <TableCell colSpan={totalColumns} className="text-center text-muted-foreground">
                    Enter a four-digit year to load the yearly maintenance plan.
                  </TableCell>
                </TableRow>
              ) : isBusy ? (
                <TableRow>
                  <TableCell colSpan={totalColumns} className="text-center text-muted-foreground">
                    Loading maintenance plan...
                  </TableCell>
                </TableRow>
              ) : visibleMachines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={totalColumns} className="text-center text-muted-foreground">
                    No machines match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                visibleMachines.map((machine, index) => {
                  const pmPlanMonths = fallbackMonthSets.get(machine.id) ?? new Set<YearlyPlanMonthKey>();
                  const frequency = normalizeYearlyPlanFrequency(
                    machine.maintenanceFrequency ?? machine.maintenance_frequency ?? machine.maintenancefrequency,
                  );

                  return (
                    <TableRow key={machine.id} data-testid={`row-yearly-plan-${machine.id}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{machine.name}</TableCell>
                      <TableCell className="font-mono">{resolveMachineCode(machine) || "-"}</TableCell>
                      <TableCell>{frequency || "-"}</TableCell>
                      <TableCell>{resolvePlanYear(machine) || "-"}</TableCell>
                      {YEARLY_PLAN_MONTHS.map(({ key }) => {
                        const isPlanned = pmPlanMonths.has(key);
                        return (
                          <TableCell
                            key={key}
                            className={
                              isPlanned
                                ? "text-center bg-yellow-200 font-semibold text-black"
                                : "text-center text-muted-foreground"
                            }
                          >
                            <button
                              type="button"
                              onClick={() => handleMonthClick(key)}
                              className={`mx-auto flex h-8 w-8 items-center justify-center rounded ${
                                isPlanned ? "text-primary" : "text-muted-foreground"
                              }`}
                              aria-label={`View ${key.toUpperCase()} schedule`}
                            >
                              <CalendarDays className="h-4 w-4" />
                            </button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
