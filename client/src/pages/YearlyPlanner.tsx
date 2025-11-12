import { ChangeEvent, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Download } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/queryClient";

const MAINTENANCE_FREQUENCIES = ["Monthly", "Quarterly", "Half Yearly", "Yearly"];
const ALL_FREQUENCY_OPTION = "all";
const ALL_PLAN_YEAR_OPTION = "all-plan-year";
const ALL_TYPE_OPTION = "all-type";
const NO_TYPE_OPTION = "__none__";

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
  type?: string | null;
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
  machineType?: string | null;
}

interface MaintenanceScheduleRecord {
  id: string;
  machineId: string;
  scheduledDate: string;
  status?: string | null;
  shift?: string | null;
  notes?: string | null;
  checksheetPath?: string | null;
  completionRemark?: string | null;
  completionAttachmentPath?: string | null;
  previousScheduledDate?: string | null;
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

const resolveMachineType = (machine: MachineRecord): string => {
  const candidates = [
    machine.type,
    (machine as any)?.machineType,
    (machine as any)?.machine_type,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
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

const downloadBlobAsFile = async (
  response: Response,
  fallbackName: string,
  fallbackExtension?: string | null,
) => {
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  let filename: string | null = null;

  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\r\n]+)/i);
  if (match?.[1]) {
    const raw = match[1].replace(/^["']|["']$/g, "");
    try {
      filename = decodeURIComponent(raw);
    } catch {
      filename = raw;
    }
  }

  if (!filename) {
    const extension =
      fallbackExtension && fallbackExtension.startsWith(".") ? fallbackExtension : "";
    filename = `${fallbackName}${extension}`;
  }

  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
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
    machineType: ALL_TYPE_OPTION,
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery<MachineRecord[]>({
    queryKey: ["/api/machines"],
  });
  const { data: maintenanceSchedules = [], isLoading: schedulesLoading } = useQuery<MaintenanceScheduleRecord[]>({
    queryKey: ["/api/maintenance-plans"],
  });

  const normalizedYear = selectedYear.trim();
  const selectedYearNumber = Number.parseInt(normalizedYear, 10);
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

  const typeOptions = useMemo(() => {
    const map = new Map<string, string>();
    let hasMissing = false;

    for (const machine of machines) {
      const machineType = resolveMachineType(machine);
      if (machineType) {
        const normalized = machineType.toLowerCase();
        if (!map.has(normalized)) {
          map.set(normalized, machineType);
        }
      } else {
        hasMissing = true;
      }
    }

    const options = Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (hasMissing) {
      options.push({ value: NO_TYPE_OPTION, label: "No type specified" });
    }

    return options;
  }, [machines]);

  const scheduleMonthStatus = useMemo(() => {
    const completed = new Map<string, Set<YearlyPlanMonthKey>>();
    const scheduled = new Map<string, Set<YearlyPlanMonthKey>>();
    const completedDetails = new Map<
      string,
      Map<
        YearlyPlanMonthKey,
        { scheduleId: string; remark: string | null; attachmentPath: string | null }
      >
    >();

    if (!Number.isFinite(selectedYearNumber)) {
      return { completed, scheduled, completedDetails };
    }

    const addToMap = (map: Map<string, Set<YearlyPlanMonthKey>>, machineId: string, key: YearlyPlanMonthKey) => {
      if (!map.has(machineId)) {
        map.set(machineId, new Set<YearlyPlanMonthKey>());
      }
      map.get(machineId)!.add(key);
    };

    for (const schedule of maintenanceSchedules) {
      if (!schedule?.machineId || !schedule?.scheduledDate) {
        continue;
      }

      const [yearStr, monthStr] = schedule.scheduledDate.split("-");
      const year = Number.parseInt(yearStr ?? "", 10);
      const monthIndex = Number.parseInt(monthStr ?? "", 10) - 1;

      if (
        !Number.isFinite(year) ||
        !Number.isFinite(monthIndex) ||
        monthIndex < 0 ||
        monthIndex >= YEARLY_PLAN_MONTHS.length ||
        year !== selectedYearNumber
      ) {
        continue;
      }

      const monthKey = YEARLY_PLAN_MONTHS[monthIndex].key;
      const status = (schedule.status || "").toLowerCase();
      if (status === "completed") {
        addToMap(completed, schedule.machineId, monthKey);
        if (!completedDetails.has(schedule.machineId)) {
          completedDetails.set(schedule.machineId, new Map());
        }
        completedDetails
          .get(schedule.machineId)!
          .set(monthKey, {
            scheduleId: schedule.id,
            remark: schedule.completionRemark ?? null,
            attachmentPath: schedule.completionAttachmentPath ?? null,
          });
      } else {
        addToMap(scheduled, schedule.machineId, monthKey);
      }
    }

    return { completed, scheduled, completedDetails };
  }, [maintenanceSchedules, selectedYearNumber]);

  const toSafeFileLabel = (label: string | null | undefined, fallback: string): string => {
    const trimmed = (label ?? "").trim();
    if (!trimmed) {
      return fallback;
    }
    const normalized = trimmed
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return normalized.length > 0 ? normalized : fallback;
  };

  const handleDownloadCompletionAttachment = useCallback(
    async (scheduleId: string, machineLabel?: string | null, attachmentPath?: string | null) => {
      try {
        const response = await fetch(resolveApiUrl(`/api/maintenance-plans/${scheduleId}/completion-attachment`), {
          credentials: "include",
        });

        if (!response.ok) {
          const errorText = (await response.text()) || response.statusText;
          throw new Error(errorText);
        }

        const fallbackLabel = toSafeFileLabel(machineLabel, "completion");
        const fallbackExtension =
          attachmentPath && attachmentPath.includes(".")
            ? attachmentPath.slice(attachmentPath.lastIndexOf("."))
            : null;

        await downloadBlobAsFile(response, fallbackLabel, fallbackExtension);
      } catch (error) {
        toast({
          title: "Failed to download document",
          description:
            error instanceof Error && error.message
              ? error.message
              : "Unable to download the completion document.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const visibleMachines = useMemo(() => {
    const nameFilter = filters.machineName.trim().toLowerCase();
    const codeFilter = filters.machineCode.trim().toLowerCase();
    const frequencyFilter = filters.frequency;
    const planYearFilter = filters.planYear;
    const typeFilter = filters.machineType;

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

      if (typeFilter !== ALL_TYPE_OPTION) {
        const machineType = resolveMachineType(machine).toLowerCase();
        if (typeFilter === NO_TYPE_OPTION) {
          if (machineType.length > 0) {
            return false;
          }
        } else if (machineType !== typeFilter) {
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

  const isBusy = machinesLoading || (isYearQueryReady && (plansLoading || schedulesLoading));
  const totalColumns = YEARLY_PLAN_MONTHS.length + 6;

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
            <Label htmlFor="filter-machine-type">Machine Type</Label>
            <Select
              value={filters.machineType}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, machineType: value }))}
            >
              <SelectTrigger id="filter-machine-type" className="w-44">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPE_OPTION}>All types</SelectItem>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
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
                const completedMonths = scheduleMonthStatus.completed.get(machine.id);
                const scheduledMonths = scheduleMonthStatus.scheduled.get(machine.id);
                const completedDetailsForMachine = scheduleMonthStatus.completedDetails.get(machine.id);
                const frequency = normalizeYearlyPlanFrequency(
                  machine.maintenanceFrequency ?? machine.maintenance_frequency ?? machine.maintenancefrequency,
                );
                const machineType = resolveMachineType(machine);

                  return (
                    <TableRow key={machine.id} data-testid={`row-yearly-plan-${machine.id}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{machine.name}</TableCell>
                      <TableCell className="font-mono">{resolveMachineCode(machine) || "-"}</TableCell>
                      <TableCell>{machineType || "-"}</TableCell>
                      <TableCell>{frequency || "-"}</TableCell>
                      <TableCell>{resolvePlanYear(machine) || "-"}</TableCell>
                      {YEARLY_PLAN_MONTHS.map(({ key }) => {
                        const isCompleted = Boolean(completedMonths?.has(key));
                        const hasScheduleRecord = Boolean(scheduledMonths?.has(key));
                        const isPlanned = isCompleted || hasScheduleRecord || pmPlanMonths.has(key);
                        const completionDetail = completedDetailsForMachine?.get(key);
                        const completionRemark = completionDetail?.remark?.trim() ?? "";
                        const hasAttachment = Boolean(completionDetail?.attachmentPath);

                        const cellClass = isCompleted
                          ? "text-center bg-emerald-200 font-semibold text-emerald-900"
                          : isPlanned
                            ? "text-center bg-yellow-200 font-semibold text-black"
                            : "text-center text-muted-foreground";

                        const buttonClass = isCompleted
                          ? "text-emerald-800"
                          : isPlanned
                            ? "text-primary"
                            : "text-muted-foreground";

                        return (
                          <TableCell key={key} className={cellClass}>
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMonthClick(key)}
                                className={`mx-auto flex h-8 w-8 items-center justify-center rounded ${buttonClass}`}
                                aria-label={`View ${key.toUpperCase()} schedule`}
                                  title={
                                    completionRemark ||
                                    (isCompleted
                                      ? "Maintenance completed"
                                      : isPlanned
                                        ? "Maintenance scheduled"
                                        : "Maintenance not planned")
                                  }
                                >
                                  <CalendarDays className="h-4 w-4" />
                                </button>
                              {hasAttachment && completionDetail ? (
                                <button
                                  type="button"
                                  className="flex items-center justify-center rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-700"
                                  onClick={() =>
                                    handleDownloadCompletionAttachment(
                                      completionDetail.scheduleId,
                                      machine.name,
                                      completionDetail.attachmentPath,
                                    )
                                  }
                                  title={
                                    completionRemark
                                      ? completionRemark
                                      : "Download completion document"
                                  }
                                  aria-label="Download completion document"
                                >
                                  <Download className="h-3 w-3" />
                                </button>
                              ) : null}
                              {completionRemark && !hasAttachment ? (
                                <span className="text-[10px] font-medium text-emerald-900">
                                  {completionRemark}
                                </span>
                              ) : null}
                            </div>
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
