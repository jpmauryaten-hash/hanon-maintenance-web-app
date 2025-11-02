import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";

const MAINTENANCE_FREQUENCIES = ["Monthly", "Quarterly", "Half Yearly", "Yearly"];
const SHIFT_OPTIONS = ["A", "B", "C", "G"];
const MONTH_REGEX =
  /(JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEPT|SEP|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC)/gi;
const MONTH_MAP: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

const DEFAULT_EMAIL_TEMPLATE = `Hello,

This is a reminder that {{machineName}}{{machineCodeFormatted}} on line {{lineName}} has maintenance scheduled on {{scheduledDate}}.

Maintenance frequency: {{maintenanceFrequency}}
Notes: {{notes}}

Regards,
Maintenance Team`;

interface Machine {
  id: string;
  name: string;
  code?: string | null;
  maintenanceFrequency?: string | null;
  pmPlanYear?: string | null;
}

interface Schedule {
  id: string;
  machineId: string;
  scheduledDate: string;
  shift?: string | null;
  status: string;
  maintenanceFrequency?: string | null;
  notes?: string | null;
  preNotificationSent: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  machineName?: string | null;
  machineCode?: string | null;
  lineName?: string | null;
  emailRecipients?: string | null;
  emailTemplate?: string | null;
}

const defaultFormState = {
  machineId: "",
  machineCode: "",
  scheduledDate: "",
  shift: SHIFT_OPTIONS[0],
  maintenanceFrequency: MAINTENANCE_FREQUENCIES[0],
  pmPlanYear: "",
  notes: "",
  emailRecipients: "",
  emailTemplate: DEFAULT_EMAIL_TEMPLATE,
};

const resolveMachineFrequency = (machine: Machine | Record<string, any>): string => {
  const candidates = [
    (machine as Machine)?.maintenanceFrequency,
    (machine as any)?.maintenance_frequency,
    (machine as any)?.maintenancefrequency,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (!trimmed) continue;

      const normalized =
        MAINTENANCE_FREQUENCIES.find(
          (option) => option.toLowerCase() === trimmed.toLowerCase(),
        ) ?? trimmed;

      return normalized;
    }
  }

  return MAINTENANCE_FREQUENCIES[0];
};

const resolveMachinePlanYear = (machine: Machine | Record<string, any>): string => {
  const candidates = [
    (machine as Machine)?.pmPlanYear,
    (machine as any)?.pm_plan_year,
    (machine as any)?.pmplanyear,
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

const parsePlanYearToAllowedMonths = (planYear: string): Set<number> => {
  const allowed = new Set<number>();
  const upper = planYear.toUpperCase();

  if (upper.includes("MONTHLY")) {
    for (let i = 0; i < 12; i++) {
      allowed.add(i);
    }
    return allowed;
  }

  const matches = upper.match(MONTH_REGEX) ?? [];
  const abbreviations = matches.map((rawMonth) => rawMonth.slice(0, 3));

  const hyphenParts = upper.split("-").map((part) => part.trim()).filter(Boolean);
  const treatAsRange = abbreviations.length === 2 && hyphenParts.length === 2;

  if (treatAsRange) {
    const start = MONTH_MAP[abbreviations[0]] ?? 0;
    const end = MONTH_MAP[abbreviations[1]] ?? start;

    let month = start;
    allowed.add(month);
    while (month !== end) {
      month = (month + 1) % 12;
      allowed.add(month);
      if (allowed.size >= 12) {
        break;
      }
    }
  } else {
    for (const token of abbreviations) {
      const index = MONTH_MAP[token];
      if (typeof index === "number") {
        allowed.add(index);
      }
    }
  }

  if (allowed.size === 0) {
    for (let i = 0; i < 12; i++) {
      allowed.add(i);
    }
  }

  return allowed;
};

function formatDateSafe(value?: string | null) {
  if (!value) {
    return "-";
  }

  try {
    return format(parseISO(value), "PP");
  } catch {
    return value;
  }
}

async function parseJsonOrThrow(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || "Server returned non-JSON response");
  }
}
export default function MaintenancePlanner() {
  const { toast } = useToast();
  const [form, setForm] = useState(() => ({ ...defaultFormState }));
  const [machinePickerOpen, setMachinePickerOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: machines = [] } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });

const machineOptions = useMemo(() => {
  return machines
    .map((machine) => ({
      id: machine.id,
      name: machine.name,
      code: machine.code || "",
      frequency: resolveMachineFrequency(machine),
      planYear: resolveMachinePlanYear(machine),
      search: `${machine.name} ${machine.code || ""}`.toLowerCase(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}, [machines]);

  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/maintenance-plans"],
  });

const selectedMachine = useMemo(
    () => machines.find((machine) => machine.id === form.machineId),
    [machines, form.machineId]
  );

useEffect(() => {
  if (selectedMachine) {
    setForm((prev) => {
      const resolvedFrequency = resolveMachineFrequency(selectedMachine);
      const resolvedPlanYear = resolveMachinePlanYear(selectedMachine);
      const nextFrequency = resolvedFrequency || prev.maintenanceFrequency || MAINTENANCE_FREQUENCIES[0];

      const nextTemplate =
        !prev.emailTemplate || prev.emailTemplate === DEFAULT_EMAIL_TEMPLATE
          ? DEFAULT_EMAIL_TEMPLATE
          : prev.emailTemplate;

      return {
        ...prev,
        maintenanceFrequency: nextFrequency,
        pmPlanYear: resolvedPlanYear,
        emailTemplate: nextTemplate,
      };
    });
  }
}, [selectedMachine]);

  const allowedMonths = useMemo(() => parsePlanYearToAllowedMonths(form.pmPlanYear || ""), [form.pmPlanYear]);
  const allowedMonthsArray = useMemo(() => Array.from(allowedMonths).sort((a, b) => a - b), [allowedMonths]);
  const selectedDate = useMemo(() => (form.scheduledDate ? parseISO(form.scheduledDate) : undefined), [form.scheduledDate]);
  const calendarBaseYear = selectedDate ? selectedDate.getFullYear() : new Date().getFullYear();
  const firstAllowedMonth = allowedMonthsArray.length > 0
    ? allowedMonthsArray[0]
    : (selectedDate ? selectedDate.getMonth() : new Date().getMonth());
  const calendarDefaultMonth = useMemo(
    () => new Date(calendarBaseYear, firstAllowedMonth, 1),
    [calendarBaseYear, firstAllowedMonth],
  );
  const minAllowedMonth = allowedMonthsArray.length > 0 ? allowedMonthsArray[0] : 0;
  const maxAllowedMonth = allowedMonthsArray.length > 0 ? allowedMonthsArray[allowedMonthsArray.length - 1] : 11;
  const fromMonth = useMemo(() => new Date(calendarBaseYear, minAllowedMonth, 1), [calendarBaseYear, minAllowedMonth]);
  const toMonth = useMemo(() => new Date(calendarBaseYear, maxAllowedMonth, 1), [calendarBaseYear, maxAllowedMonth]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        machineId: form.machineId,
        scheduledDate: form.scheduledDate,
        shift: SHIFT_OPTIONS.includes(form.shift) ? form.shift : undefined,
        maintenanceFrequency: form.maintenanceFrequency || undefined,
        notes: form.notes || undefined,
        emailRecipients: form.emailRecipients?.trim() ? form.emailRecipients : undefined,
        emailTemplate: form.emailTemplate?.trim() ? form.emailTemplate : undefined,
      };

      const response = await apiRequest("POST", "/api/maintenance-plans", payload);
      return await parseJsonOrThrow(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-plans"] });
      setForm(() => ({ ...defaultFormState }));
      toast({
        title: "Maintenance scheduled",
        description: "Maintenance plan created successfully.",
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

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/maintenance-plans/${id}/complete`);
      return await parseJsonOrThrow(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-plans"] });
      toast({
        title: "Maintenance completed",
        description: "Post-maintenance notification triggered.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to complete maintenance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.machineId || !form.scheduledDate) {
      toast({
        title: "Missing information",
        description: "Please select a machine and choose a scheduled date.",
        variant: "destructive",
      });
      return;
    }

    if (!form.shift || !SHIFT_OPTIONS.includes(form.shift)) {
      toast({
        title: "Missing shift",
        description: "Please select a valid shift (A, B, C, or G).",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedDateObj = parseISO(form.scheduledDate);
      if (!allowedMonths.has(selectedDateObj.getMonth())) {
        toast({
          title: "Invalid scheduled date",
          description: "Select a date that aligns with the machine's PM plan year.",
          variant: "destructive",
        });
        return;
      }
    } catch {
      toast({
        title: "Invalid scheduled date",
        description: "Please choose a valid date.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate();
  };

  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      const aDate = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
      const bDate = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
      return aDate - bDate;
    });
  }, [schedules]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Maintenance Planner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Schedule and track machine maintenance based on frequency targets.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Schedule Maintenance</h2>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="planner-machine">Machine</Label>
            <Popover open={machinePickerOpen} onOpenChange={setMachinePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={machinePickerOpen}
                  className="w-full justify-between"
                  data-testid="combobox-planner-machine"
                >
                  {form.machineId ? (
                    <span className="flex flex-col items-start">
                      <span>{selectedMachine?.name || "Unknown machine"}</span>
                      {form.machineCode ? (
                        <span className="text-xs text-muted-foreground">{form.machineCode}</span>
                      ) : null}
                    </span>
                  ) : (
                    "Select machine"
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[280px]" align="start">
                <Command>
                  <CommandInput placeholder="Search by machine name or code..." />
                  <CommandEmpty>No machine found.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      {machineOptions.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={option.search}
                          onSelect={() => {
                            setForm((prev) => ({
                              ...prev,
                              machineId: option.id,
                              machineCode: option.code,
                              maintenanceFrequency: option.frequency || MAINTENANCE_FREQUENCIES[0],
                              pmPlanYear: option.planYear || "",
                            }));
                            setMachinePickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              option.id === form.machineId ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex flex-col">
                            <span>{option.name}</span>
                            {option.code ? (
                              <span className="text-xs text-muted-foreground">{option.code}</span>
                            ) : null}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="planner-machine-code">Machine Code</Label>
            <Input
              id="planner-machine-code"
              value={form.machineCode}
              readOnly
              placeholder="Auto-filled from machine"
              data-testid="input-planner-machine-code"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="planner-date">Scheduled Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                  data-testid="button-planner-date"
                >
                  {selectedDate ? format(selectedDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Calendar
                  key={form.pmPlanYear || "all"}
                  mode="single"
                  defaultMonth={calendarDefaultMonth}
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (!date) return;
                    if (!allowedMonths.has(date.getMonth())) {
                      return;
                    }
                    setForm((prev) => ({
                      ...prev,
                      scheduledDate: format(date, "yyyy-MM-dd"),
                    }));
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => !allowedMonths.has(date.getMonth())}
                  fromMonth={fromMonth}
                  toMonth={toMonth}
                />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="planner-shift">Shift</Label>
          <Select
            value={form.shift}
            onValueChange={(value) => setForm((prev) => ({ ...prev, shift: value }))}
          >
            <SelectTrigger id="planner-shift" data-testid="select-planner-shift">
              <SelectValue placeholder="Select shift" />
            </SelectTrigger>
            <SelectContent>
              {SHIFT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose the shift the maintenance team will cover (A, B, C, or G).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="planner-frequency">Maintenance Frequency</Label>
          <Input
              id="planner-frequency"
              value={form.maintenanceFrequency || "Not Specified"}
              readOnly
              className="bg-muted cursor-not-allowed"
              data-testid="input-planner-frequency"
            />
            <p className="text-xs text-muted-foreground">
              Frequency is determined automatically from the selected machine&apos;s settings.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="planner-plan-year">PM Plan Year</Label>
            <Input
              id="planner-plan-year"
              value={form.pmPlanYear || "Not Specified"}
              readOnly
              className="bg-muted cursor-not-allowed"
              data-testid="input-planner-plan-year"
            />
            <p className="text-xs text-muted-foreground">
              Calendar availability reflects the machine&apos;s PM plan year.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="planner-recipients">Email Recipients</Label>
            <Textarea
              id="planner-recipients"
              value={form.emailRecipients}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, emailRecipients: event.target.value }))
              }
              placeholder="Enter recipient emails separated by commas"
              rows={2}
              data-testid="textarea-planner-recipients"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="planner-template">Email Template</Label>
            <Textarea
              id="planner-template"
              value={form.emailTemplate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, emailTemplate: event.target.value }))
              }
              placeholder="Customize the email body. Use placeholders like {{machineName}}, {{scheduledDate}}."
              rows={6}
              data-testid="textarea-planner-template"
            />
            <p className="text-xs text-muted-foreground">
              Supported placeholders: {"{{machineName}}, {{machineCode}}, {{machineCodeFormatted}}, {{lineName}}, {{scheduledDate}}, {{maintenanceFrequency}}, {{notes}}, {{completedDate}}"}
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="planner-notes">Notes</Label>
            <Textarea
              id="planner-notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Add relevant notes (optional)"
              rows={3}
              data-testid="textarea-planner-notes"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button
              type="submit"
              disabled={createMutation.isPending}
              data-testid="button-create-maintenance-plan"
            >
              {createMutation.isPending ? "Saving..." : "Schedule Maintenance"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Scheduled Maintenance</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Machine</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Pre-Reminder Sent</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSchedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  No maintenance plans scheduled.
                </TableCell>
              </TableRow>
            ) : (
              sortedSchedules.map((schedule) => (
                <TableRow key={schedule.id} data-testid={`row-maintenance-${schedule.id}`}>
                  <TableCell>
                    <div className="font-medium">{schedule.machineName || "Unknown Machine"}</div>
                    <div className="text-xs text-muted-foreground">{schedule.machineCode || "-"}</div>
                  </TableCell>
                  <TableCell>{schedule.lineName || "-"}</TableCell>
                  <TableCell>{formatDateSafe(schedule.scheduledDate)}</TableCell>
                  <TableCell>{schedule.shift || "-"}</TableCell>
                  <TableCell className="capitalize">{schedule.status}</TableCell>
                  <TableCell>{schedule.maintenanceFrequency || "-"}</TableCell>
                  <TableCell className="max-w-[200px] whitespace-pre-wrap">
                    {schedule.emailRecipients?.length
                      ? schedule.emailRecipients
                      : "Default recipients"}
                  </TableCell>
                  <TableCell className="max-w-[220px]">{schedule.notes || "-"}</TableCell>
                  <TableCell>{schedule.preNotificationSent ? "Yes" : "No"}</TableCell>
                  <TableCell>{schedule.completedAt ? formatDateSafe(schedule.completedAt) : "-"}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => completeMutation.mutate(schedule.id)}
                      disabled={schedule.status === "completed" || completeMutation.isPending}
                      data-testid={`button-complete-maintenance-${schedule.id}`}
                    >
                      Mark Completed
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}




