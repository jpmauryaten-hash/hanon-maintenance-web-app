import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation, useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

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
const SHIFT_OPTIONS = ["A", "B", "C", "G"] as const;
const MONTH_LABEL_MAP = new Map<YearlyPlanMonthKey, string>(
  YEARLY_PLAN_MONTHS.map(({ key, label }) => [key, label]),
);

const sanitizeShift = (value: string | null | undefined): string => {
  if (typeof value !== "string") {
    return "";
  }
  const upper = value.trim().toUpperCase();
  return SHIFT_OPTIONS.includes(upper as (typeof SHIFT_OPTIONS)[number]) ? upper : "";
};

type YearlyPlanMonthKey = (typeof YEARLY_PLAN_MONTHS)[number]["key"];
type YearlyPlanMonthRecord = Record<YearlyPlanMonthKey, string | null>;

interface YearlyMaintenancePlanApiRecord extends Partial<YearlyPlanMonthRecord> {
  id?: string;
  machineId: string;
  planYear: number;
  frequency?: string | null;
  machineName?: string | null;
  machineCode?: string | null;
}

interface MaintenanceScheduleRecord {
  id: string;
  machineId: string;
  scheduledDate: string;
  status?: string | null;
  shift?: string | null;
  notes?: string | null;
}

type PlanEditState = {
  machine: any;
  planValues: Map<YearlyPlanMonthKey, string>;
  existingSchedule: MaintenanceScheduleRecord | null;
  existingScheduleDay: number | null;
  allowedMonths: Set<YearlyPlanMonthKey>;
  initialDay: number;
  initialShift: string;
  planShift: string;
  plannedDay: number | null;
  fallbackDay: number | null;
  frequency: string;
};

const normalizeYearlyPlanFrequency = (value: string | null | undefined): string => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const match = MAINTENANCE_FREQUENCIES.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? "";
};

const frequencyBadges: Record<string, string> = {
  Monthly: "M",
  Quarterly: "Q",
  "Half Yearly": "H",
};

const resolveMaintenanceFrequency = (machine: any): string => {
  const candidates = [
    machine?.maintenanceFrequency,
    machine?.maintenance_frequency,
    machine?.maintenancefrequency,
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

const resolvePmPlanYear = (machine: any): string => {
  const candidates = [
    machine?.pmPlanYear,
    machine?.pm_plan_year,
    machine?.pmplanyear,
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

const parsePmPlanYearToMonths = (value: string): Set<YearlyPlanMonthKey> => {
  const months = new Set<YearlyPlanMonthKey>();
  if (!value) {
    return months;
  }

  const upper = value.toUpperCase();
  if (upper.includes("MONTHLY")) {
    for (const { key } of YEARLY_PLAN_MONTHS) {
      months.add(key);
    }
    return months;
  }

  const regex =
    /(JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEPT|SEP|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC)/gi;
  const matches = Array.from(upper.matchAll(regex));
  const tokens = matches.map((match) => match[0].slice(0, 3));

  if (tokens.length === 0) {
    return months;
  }

  const MONTH_SEQUENCE = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

  const hyphenParts = upper.split("-").map((part) => part.trim()).filter(Boolean);
  if (hyphenParts.length === 2 && tokens.length >= 2) {
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    const startIndex = MONTH_SEQUENCE.indexOf(startToken);
    const endIndex = MONTH_SEQUENCE.indexOf(endToken);
    if (startIndex !== -1 && endIndex !== -1) {
      let index = startIndex;
      while (true) {
        const monthKey = YEARLY_PLAN_MONTHS[index].key;
        months.add(monthKey);
        if (index === endIndex) {
          break;
        }
        index = (index + 1) % 12;
      }
      return months;
    }
  }

  for (const token of tokens) {
    const idx = MONTH_SEQUENCE.indexOf(token);
    if (idx !== -1) {
      months.add(YEARLY_PLAN_MONTHS[idx].key);
    }
  }

  return months;
};

export default function YearlyPlanMonthView() {
const [, params] = useRoute("/yearly-planner/month/:month");
const monthParam = (params?.month || "").toLowerCase() as YearlyPlanMonthKey;
const monthConfig = YEARLY_PLAN_MONTHS.find((month) => month.key === monthParam);
const { toast } = useToast();

const [location] = useLocation();
const queryIndex = location.indexOf("?");
const search = queryIndex === -1 ? "" : location.slice(queryIndex);
const searchParams = new URLSearchParams(search);
const yearParam = searchParams.get("year");
const parsedYear = yearParam ? Number.parseInt(yearParam, 10) : NaN;
const effectiveYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

const today = new Date();
const todayYear = today.getFullYear();
const todayMonth = today.getMonth();
const todayDate = today.getDate();

  const { data: machines = [], isLoading: machinesLoading } = useQuery<any[]>({
    queryKey: ["/api/machines"],
  });

  const yearQueryKey =
    Number.isFinite(parsedYear) && String(parsedYear).length === 4
      ? `/api/yearly-maintenance-plans?year=${parsedYear}`
      : `/api/yearly-maintenance-plans?year=${effectiveYear}`;

  const { data: yearlyPlans = [], isLoading: plansLoading } = useQuery<YearlyMaintenancePlanApiRecord[]>({
    queryKey: [yearQueryKey],
  });

  const planShiftMutation = useMutation({
    mutationFn: async ({ planRecord }: { planRecord: Record<string, string> }) => {
      if (!monthConfig) {
        throw new Error("Month configuration is missing.");
      }

      const response = await apiRequest("POST", "/api/yearly-maintenance-plans", {
        year: effectiveYear,
        plans: [planRecord],
      });
      const raw = await response.text();
      if (!raw) {
        return null;
      }
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    onSuccess: () => {
      if (yearQueryKey) {
        queryClient.invalidateQueries({ queryKey: [yearQueryKey] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePlanShiftChange = async (
    machine: any,
    shift: string | null,
    existingPlanValues: Map<YearlyPlanMonthKey, string>,
  ) => {
    if (!monthConfig) {
      return;
    }

    const normalizedShift = sanitizeShift(shift);
    const currentValue = sanitizeShift(existingPlanValues.get(monthConfig.key));
    if (currentValue === normalizedShift) {
      return;
    }

    const record: Record<string, string> = {
      machineId: machine.id,
      frequency: normalizeYearlyPlanFrequency(resolveMaintenanceFrequency(machine)) || "",
    };

    for (const { key } of YEARLY_PLAN_MONTHS) {
      if (key === monthConfig.key) {
        record[key] = normalizedShift;
      } else {
        record[key] = sanitizeShift(existingPlanValues.get(key));
      }
    }

    await planShiftMutation.mutateAsync({ planRecord: record });
  };

const { data: maintenanceSchedules = [], isLoading: schedulesLoading } = useQuery<MaintenanceScheduleRecord[]>({
  queryKey: ["/api/maintenance-plans"],
});

const [editingCell, setEditingCell] = useState<PlanEditState | null>(null);
const [formShift, setFormShift] = useState<string>(SHIFT_OPTIONS[0]);
const [formDay, setFormDay] = useState<string>("");
const [formReason, setFormReason] = useState<string>("");

useEffect(() => {
  if (editingCell) {
    setFormShift(editingCell.initialShift);
    setFormDay(String(editingCell.initialDay));
    setFormReason("");
  }
}, [editingCell]);

const scheduleMutation = useMutation<
  void,
  Error,
  {
    machine: any;
    selectedDay: number;
    shift: string;
    reason: string;
    existingSchedule: MaintenanceScheduleRecord | null;
    planValues: Map<YearlyPlanMonthKey, string>;
  }
>({
  mutationFn: async ({ machine, selectedDay, shift, reason, existingSchedule }) => {
    if (!monthConfig) {
      throw new Error("Month configuration is missing.");
    }

    const monthIndex = YEARLY_PLAN_MONTHS.findIndex((month) => month.key === monthConfig.key);
    if (monthIndex < 0) {
      throw new Error("Month index not found.");
    }

    const formattedDate = `${effectiveYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(selectedDay).padStart(
      2,
      "0",
    )}`;

    if (existingSchedule) {
      const payload: Record<string, any> = {
        scheduledDate: formattedDate,
        shift,
      };

      if (reason) {
        const previousNotes = existingSchedule.notes?.trim();
        payload.notes = previousNotes
          ? `${previousNotes}\nNote (${formattedDate}): ${reason}`
          : `Note (${formattedDate}): ${reason}`;
      }

      await apiRequest("PUT", `/api/maintenance-plans/${existingSchedule.id}`, payload);
    } else {
      const payload: Record<string, any> = {
        machineId: machine.id,
        scheduledDate: formattedDate,
        shift,
      };

      if (reason) {
        payload.notes = `Note (${formattedDate}): ${reason}`;
      }

      await apiRequest("POST", "/api/maintenance-plans", payload);
    }
  },
  onSuccess: async (_data, variables) => {
    try {
      await handlePlanShiftChange(variables.machine, variables.shift, variables.planValues);
    } catch {
      // Handled by planShiftMutation onError
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/maintenance-plans"] });
    setEditingCell(null);
    setFormReason("");
    toast({
      title: "Schedule saved",
      description: "Maintenance plan updated for this month.",
    });
  },
  onError: (error: Error) => {
    toast({
      title: "Failed to schedule maintenance",
      description: error.message,
      variant: "destructive",
    });
  },
});

const sortedMachines = useMemo(
  () =>
    [...machines]
      .filter((machine) => machine && machine.id)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [machines],
  );

const scheduledDaysByMachine = useMemo(() => {
  const map = new Map<string, Map<number, MaintenanceScheduleRecord>>();

  if (!monthConfig) {
    return map;
  }

  const monthIndex = YEARLY_PLAN_MONTHS.findIndex((month) => month.key === monthConfig.key);
  if (monthIndex < 0) {
    return map;
  }

  for (const schedule of maintenanceSchedules) {
    if (!schedule?.machineId || !schedule?.scheduledDate) {
      continue;
    }

    const [yearStr, monthStr, dayStr] = schedule.scheduledDate.split("-");
    const year = Number.parseInt(yearStr ?? "", 10);
    const month = Number.parseInt(monthStr ?? "", 10) - 1;
    const day = Number.parseInt(dayStr ?? "", 10);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      continue;
    }

    if (year !== effectiveYear || month !== monthIndex) {
      continue;
    }

    if (!map.has(schedule.machineId)) {
      map.set(schedule.machineId, new Map<number, MaintenanceScheduleRecord>());
    }

    const normalizedSchedule: MaintenanceScheduleRecord = {
      ...schedule,
      shift: sanitizeShift(schedule.shift),
    };

    map.get(schedule.machineId)!.set(day, normalizedSchedule);
  }

  return map;
}, [effectiveYear, maintenanceSchedules, monthConfig]);

const latestScheduleByMachine = useMemo(() => {
  const map = new Map<string, MaintenanceScheduleRecord>();
  scheduledDaysByMachine.forEach((dayMap, machineId) => {
    const values = Array.from(dayMap.values());
    values.sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
    const latest = values.length > 0 ? values[values.length - 1] : undefined;
    if (latest) {
      map.set(machineId, latest);
    }
  });
  return map;
}, [scheduledDaysByMachine]);

const { planMonthSets, planMonthValues } = useMemo(() => {
  const setMap = new Map<string, Set<YearlyPlanMonthKey>>();
  const valueMap = new Map<string, Map<YearlyPlanMonthKey, string>>();

    for (const plan of yearlyPlans) {
      if (!plan?.machineId) continue;
      const monthSet = new Set<YearlyPlanMonthKey>();
      const valueEntry = new Map<YearlyPlanMonthKey, string>();

      for (const { key } of YEARLY_PLAN_MONTHS) {
        const value = plan[key as keyof YearlyPlanMonthRecord] as string | null | undefined;
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed.length > 0) {
            monthSet.add(key);
            valueEntry.set(key, trimmed.toUpperCase());
          }
        }
      }

      if (monthSet.size > 0) {
        setMap.set(plan.machineId, monthSet);
      }
      if (valueEntry.size > 0) {
        valueMap.set(plan.machineId, valueEntry);
      }
    }

  return { planMonthSets: setMap, planMonthValues: valueMap };
}, [yearlyPlans]);

const fallbackMonthSets = useMemo(() => {
  const map = new Map<string, Set<YearlyPlanMonthKey>>();
  for (const machine of machines) {
    const planYear = resolvePmPlanYear(machine);
    map.set(machine.id, parsePmPlanYearToMonths(planYear));
  }
  return map;
}, [machines]);

const highlightMonthSets = useMemo(() => {
  const map = new Map<string, Set<YearlyPlanMonthKey>>();
  for (const machine of machines) {
    const planned = planMonthSets.get(machine.id);
    if (planned && planned.size > 0) {
      map.set(machine.id, planned);
      continue;
    }
    map.set(machine.id, fallbackMonthSets.get(machine.id) ?? new Set<YearlyPlanMonthKey>());
  }
  return map;
}, [machines, planMonthSets, fallbackMonthSets]);

const scheduledMachines = useMemo(() => {
  if (!monthConfig) {
    return [];
  }

  return sortedMachines.filter((machine) => {
    const scheduledDayMap = scheduledDaysByMachine.get(machine.id);
    if (scheduledDayMap && scheduledDayMap.size > 0) {
      return true;
    }

    const planValues = planMonthValues.get(machine.id);
    if (planValues && planValues.has(monthConfig.key)) {
      return true;
    }

    const highlightSet = highlightMonthSets.get(machine.id);
    if (highlightSet && highlightSet.has(monthConfig.key)) {
      return true;
    }

    const fallbackSet = fallbackMonthSets.get(machine.id);
    if (fallbackSet && fallbackSet.has(monthConfig.key)) {
      return true;
    }

    return false;
  });
}, [fallbackMonthSets, highlightMonthSets, monthConfig, planMonthValues, scheduledDaysByMachine, sortedMachines]);

const [filters, setFilters] = useState({
  machineName: "",
  frequency: ALL_FREQUENCY_OPTION,
  planYear: ALL_PLAN_YEAR_OPTION,
});

const frequencyOptions = useMemo(() => {
  const set = new Set<string>();
  for (const machine of scheduledMachines) {
    const frequency = normalizeYearlyPlanFrequency(resolveMaintenanceFrequency(machine));
    if (frequency) {
      set.add(frequency);
    }
  }
  return Array.from(set).sort();
}, [scheduledMachines]);

const planYearOptions = useMemo(() => {
  const set = new Set<string>();
  for (const machine of scheduledMachines) {
    const planYear = resolvePmPlanYear(machine);
    if (planYear) {
      set.add(planYear);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}, [scheduledMachines]);

const filteredMachines = useMemo(() => {
  const nameFilter = filters.machineName.trim().toLowerCase();
  const frequencyFilter = filters.frequency;
  const planYearFilter = filters.planYear;

  return scheduledMachines.filter((machine) => {
    if (nameFilter && !(machine.name || "").toLowerCase().includes(nameFilter)) {
      return false;
    }

    const frequency = normalizeYearlyPlanFrequency(resolveMaintenanceFrequency(machine));
    if (frequencyFilter !== ALL_FREQUENCY_OPTION && frequency !== frequencyFilter) {
      return false;
    }

    if (planYearFilter !== ALL_PLAN_YEAR_OPTION) {
      const planYear = (resolvePmPlanYear(machine) || "").toLowerCase();
      if (!planYear.includes(planYearFilter.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}, [filters, scheduledMachines]);

const monthIndex = monthConfig ? YEARLY_PLAN_MONTHS.findIndex((month) => month.key === monthConfig.key) : -1;
  const monthDays =
    monthIndex >= 0
      ? Array.from({ length: new Date(effectiveYear, monthIndex + 1, 0).getDate() }, (_, index) => {
          const dayNumber = index + 1;
          const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
            new Date(effectiveYear, monthIndex, dayNumber).getDay()
          ];
          return { day: dayNumber, weekday };
        })
      : [];

  if (!monthConfig) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Invalid Month</h1>
          <p className="text-muted-foreground">The month you requested could not be found.</p>
        </Card>
      </div>
    );
  }

  if (machinesLoading || plansLoading || schedulesLoading) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <p className="text-muted-foreground">Loading maintenance schedule...</p>
        </Card>
      </div>
    );
  }

  const openPlanDialog = (
    machine: any,
    planValues: Map<YearlyPlanMonthKey, string>,
    scheduledDayMap: Map<number, MaintenanceScheduleRecord>,
    latestSchedule: MaintenanceScheduleRecord | null,
    planShiftValue: string,
    plannedDayValue: number | null,
    fallbackDayValue: number | null,
    allowedMonths: Set<YearlyPlanMonthKey>,
    frequency: string,
  ) => {
    if (!monthConfig) {
      return;
    }

    if (allowedMonths.size > 0 && !allowedMonths.has(monthConfig.key)) {
      toast({
        title: "Month not allowed",
        description: "This machine is not planned for this month.",
        variant: "destructive",
      });
      return;
    }

    const planValuesSnapshot = new Map(planValues);
    const existingSchedule = latestSchedule ?? null;
    const existingScheduleDay =
      existingSchedule && typeof existingSchedule.scheduledDate === "string"
        ? Number.parseInt(existingSchedule.scheduledDate.split("-")[2] ?? "", 10)
        : null;

    const defaultDay =
      existingScheduleDay ??
      plannedDayValue ??
      fallbackDayValue ??
      (monthDays[0]?.day ?? 1);

    const initialShiftCandidate =
      sanitizeShift(existingSchedule?.shift) || sanitizeShift(planShiftValue) || SHIFT_OPTIONS[0];
    const initialShift = sanitizeShift(initialShiftCandidate) || SHIFT_OPTIONS[0];

    setEditingCell({
      machine,
      planValues: planValuesSnapshot,
      existingSchedule,
      existingScheduleDay,
      allowedMonths,
      initialDay: defaultDay,
      initialShift,
      planShift: sanitizeShift(planShiftValue),
      plannedDay: plannedDayValue,
      fallbackDay: fallbackDayValue,
      frequency,
    });
    setFormShift(initialShift);
    setFormDay(String(defaultDay));
    setFormReason("");
  };

  const handleDialogClose = () => {
    if (scheduleMutation.isPending || planShiftMutation.isPending) {
      return;
    }
    setEditingCell(null);
  };

  const handleDialogSubmit = () => {
    if (!editingCell || !monthConfig) {
      return;
    }

    const selectedDayNumber = Number.parseInt(formDay, 10);
    if (!Number.isFinite(selectedDayNumber) || selectedDayNumber < 1 || selectedDayNumber > monthDays.length) {
      toast({
        title: "Select a valid date",
        description: "Choose a day within the current month.",
        variant: "destructive",
      });
      return;
    }

    const isPastMonth =
      effectiveYear < todayYear ||
      (effectiveYear === todayYear && monthIndex < todayMonth);
    if (isPastMonth) {
      toast({
        title: "Past month locked",
        description: "You can only schedule maintenance for the current or future months.",
        variant: "destructive",
      });
      return;
    }

    const isCurrentMonth =
      effectiveYear === todayYear && monthIndex === todayMonth;
    if (isCurrentMonth && selectedDayNumber < todayDate) {
      toast({
        title: "Past date blocked",
        description: "Please pick a date that has not already passed.",
        variant: "destructive",
      });
      return;
    }

    const normalizedShift = sanitizeShift(formShift);
    if (!normalizedShift) {
      toast({
        title: "Shift required",
        description: "Please select a shift before saving.",
        variant: "destructive",
      });
      return;
    }

    if (editingCell.allowedMonths.size > 0 && !editingCell.allowedMonths.has(monthConfig.key)) {
      toast({
        title: "Month not allowed",
        description: "This machine is not planned for this month.",
        variant: "destructive",
      });
      return;
    }

    const reasonIsRequired =
      Boolean(editingCell.existingSchedule) && editingCell.existingScheduleDay !== selectedDayNumber;

    if (reasonIsRequired && !formReason.trim()) {
      toast({
        title: "Note required",
        description: "Provide a note for changing the scheduled date.",
        variant: "destructive",
      });
      return;
    }

    const existingShift = sanitizeShift(editingCell.existingSchedule?.shift ?? editingCell.planShift);
    if (
      editingCell.existingSchedule &&
      editingCell.existingScheduleDay === selectedDayNumber &&
      existingShift === normalizedShift
    ) {
      toast({
        title: "No changes detected",
        description: "Update the shift or date before saving.",
      });
      return;
    }

    scheduleMutation.mutate({
      machine: editingCell.machine,
      selectedDay: selectedDayNumber,
      shift: normalizedShift,
      reason: formReason.trim(),
      existingSchedule: editingCell.existingSchedule,
      planValues: editingCell.planValues,
    });
  };

  const selectedDayNumber = Number.parseInt(formDay, 10);
  const noteRequired = Boolean(
    editingCell?.existingSchedule &&
      !Number.isNaN(selectedDayNumber) &&
      editingCell.existingScheduleDay !== selectedDayNumber,
  );
  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {monthConfig.label} {effectiveYear} Maintenance Schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            
          </p>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6">
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
            <Label htmlFor="filter-frequency">Frequency</Label>
            <Select
              value={filters.frequency}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, frequency: value }))}
            >
              <SelectTrigger id="filter-frequency" className="w-44">
                <SelectValue placeholder="All frequencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FREQUENCY_OPTION}>All frequencies</SelectItem>
                {frequencyOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-plan-year">PM Plan Year</Label>
            <Select
              value={filters.planYear}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, planYear: value }))}
            >
              <SelectTrigger id="filter-plan-year" className="w-48">
                <SelectValue placeholder="All plan years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PLAN_YEAR_OPTION}>All plan years</SelectItem>
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
                <TableHead>S. No.</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Machine Name</TableHead>
                <TableHead>PM Plan Year</TableHead>
                <TableHead>Plan / Actual</TableHead>
                {monthDays.map((day) => (
                  <TableHead key={day.day} className="text-center">
                    <div className="flex flex-col items-center">
                      <span>{day.day}</span>
                      <span className="text-xs text-muted-foreground">{day.weekday}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMachines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={monthDays.length + 5} className="text-center text-muted-foreground">
                    No machines scheduled for this month.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMachines.map((machine, index) => {
                  const frequency = normalizeYearlyPlanFrequency(resolveMaintenanceFrequency(machine));
                  
                  const planValues = planMonthValues.get(machine.id) ?? new Map<YearlyPlanMonthKey, string>();
                  const rawPlanValue = (planValues.get(monthConfig.key) ?? "").trim();
                  const extractedPlanShift = rawPlanValue.replace(/\d+/g, "").trim().toUpperCase();
                  const planShift = sanitizeShift(extractedPlanShift);

                  const numericTokens = rawPlanValue.split(/\D+/).filter(Boolean);
                  let plannedDay: number | null = null;
                  for (const token of numericTokens) {
                    const value = Number.parseInt(token, 10);
                    if (Number.isFinite(value) && value >= 1 && value <= monthDays.length) {
                      plannedDay = value;
                    }
                  }
                  const hasValidPlannedDay = plannedDay !== null;
                  const fallbackDisplayDay = monthDays[0]?.day ?? null;
                  const hasPlanShift = Boolean(planShift);

                  const scheduledDayMap =
                    scheduledDaysByMachine.get(machine.id) ?? new Map<number, MaintenanceScheduleRecord>();
                  const latestSchedule = latestScheduleByMachine.get(machine.id) ?? null;
                  const scheduledShift = sanitizeShift(latestSchedule?.shift);
                  const scheduledDay =
                    latestSchedule && typeof latestSchedule.scheduledDate === "string"
                      ? Number.parseInt(latestSchedule.scheduledDate.split("-")[2] ?? "", 10)
                      : null;
                  const hasScheduledShift = Boolean(scheduledShift);
                  const isPastMonth =
                    effectiveYear < todayYear ||
                    (effectiveYear === todayYear && monthIndex < todayMonth);
                  const isCurrentMonth =
                    effectiveYear === todayYear && monthIndex === todayMonth;
                  const allowedMonths =
                    highlightMonthSets.get(machine.id) ??
                    fallbackMonthSets.get(machine.id) ??
                    new Set<YearlyPlanMonthKey>();
                  const isMonthAllowed = allowedMonths.size === 0 || allowedMonths.has(monthConfig.key);
                  const allowedMonthsSnapshot = new Set<YearlyPlanMonthKey>(allowedMonths);
                  const isProcessing = scheduleMutation.isPending || planShiftMutation.isPending;
                  return (
                    <Fragment key={machine.id}>
                      <TableRow>
                        <TableCell rowSpan={2}>{index + 1}</TableCell>
                        <TableCell rowSpan={2}>
                        <TableCell rowSpan={2}>{frequencyBadges[frequency] ?? (frequency || "-")}</TableCell>
                        </TableCell>
                        <TableCell rowSpan={2}>{machine.name}</TableCell>
                        <TableCell rowSpan={2}>{resolvePmPlanYear(machine) || "-"}</TableCell>
                        <TableCell className="font-medium">Plan</TableCell>
                        {monthDays.map((day) => {
                          const isScheduledCell = hasScheduledShift && scheduledDay === day.day;
                          const planCellDisplay = isScheduledCell ? scheduledShift : "-";
                          const showEmptyState = !isScheduledCell;

                          const handlePlanCellClick = () => {
                            if (!isMonthAllowed) {
                              toast({
                                title: "Month not allowed",
                                description: "This machine is not planned for this month.",
                                variant: "destructive",
                              });
                              return;
                            }

                            if (isPastMonth) {
                              toast({
                                title: "Past month locked",
                                description: "Updates are disabled for months that have already passed.",
                                variant: "destructive",
                              });
                              return;
                            }

                            openPlanDialog(
                              machine,
                              planValues,
                              scheduledDayMap,
                              latestScheduleByMachine.get(machine.id) ?? null,
                              planShift,
                              hasValidPlannedDay ? plannedDay : null,
                              fallbackDisplayDay,
                              allowedMonthsSnapshot,
                              frequency,
                            );
                          };

                          return (
                            <TableCell key={`plan-${machine.id}-${day.day}`} className="text-center">
                              <button
                                type="button"
                                onClick={handlePlanCellClick}
                                disabled={!isMonthAllowed || isPastMonth || isProcessing}
                                title={
                                  !isMonthAllowed
                                    ? "This machine is not planned for this month."
                                    : isPastMonth
                                      ? "Past months cannot be rescheduled."
                                      : "Update plan"
                                }
                                className={cn(
                                  "flex w-full items-center justify-center gap-2 rounded border border-dashed py-1 text-sm transition",
                                  isMonthAllowed
                                    ? isPastMonth
                                      ? "cursor-not-allowed opacity-50"
                                      : "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                                    : "cursor-not-allowed opacity-50",
                                  isProcessing && "cursor-wait opacity-50",
                                )}
                              >
                                {showEmptyState ? (
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  planCellDisplay
                                )}
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      <TableRow className="bg-muted/40">
                        <TableCell className="font-medium">Actual</TableCell>
                        {monthDays.map((day) => {
                          const shouldHighlightActual = hasScheduledShift && scheduledDay === day.day;
                          const actualCellClass = shouldHighlightActual
                            ? "text-center bg-yellow-200 font-semibold text-black"
                            : "text-center";
                          const actualCellValue = shouldHighlightActual ? "" : "-";

                          return (
                            <TableCell key={`actual-${machine.id}-${day.day}`} className={actualCellClass}>
                              {actualCellValue}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      <Dialog
        open={Boolean(editingCell)}
        onOpenChange={(open) => {
          if (!open) {
            handleDialogClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Plan Maintenance</DialogTitle>
            <DialogDescription>
              {editingCell
                ? `${editingCell.machine?.name || "Machine"} Ã‚Â· ${monthConfig.label} ${effectiveYear}`
                : "Select a shift and date to plan maintenance."}
            </DialogDescription>
          </DialogHeader>
          {editingCell ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dialog-shift">Shift</Label>
                <Select value={formShift} onValueChange={setFormShift}>
                  <SelectTrigger id="dialog-shift">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        Shift {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dialog-day">Date</Label>
                <Select value={formDay} onValueChange={setFormDay}>
                  <SelectTrigger id="dialog-day">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthDays.map((dayOption) => (
                      <SelectItem key={dayOption.day} value={String(dayOption.day)}>
                        {`${String(dayOption.day).padStart(2, "0")} (${dayOption.weekday})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                {editingCell.frequency
                  ? `Frequency: ${editingCell.frequency}. `
                  : ""}
                {editingCell.allowedMonths.size > 0
                  ? `Allowed months: ${Array.from(editingCell.allowedMonths)
                      .map((key) => MONTH_LABEL_MAP.get(key) ?? key.toUpperCase())
                      .join(", ")}.`
                  : "Allowed every month."}
              </p>

              <div className="space-y-2">
                <Label htmlFor="dialog-note">Note (if any)</Label>
                <Textarea
                  id="dialog-note"
                  value={formReason}
                  onChange={(event) => setFormReason(event.target.value)}
                  rows={3}
                  placeholder={
                    noteRequired ? "Explain why the date is changing." : "Add any notes (optional)."
                  }
                  required={noteRequired}
                />
                {noteRequired ? (
                  <p className="text-xs text-muted-foreground">
                    Provide a note when rescheduling an existing maintenance date.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDialogClose}
              disabled={scheduleMutation.isPending || planShiftMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDialogSubmit}
              disabled={scheduleMutation.isPending || planShiftMutation.isPending}
            >
              {scheduleMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

