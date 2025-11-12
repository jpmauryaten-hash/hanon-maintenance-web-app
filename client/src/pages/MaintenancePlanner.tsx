import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ChevronsUpDown, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, resolveApiUrl } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/lib/auth";

const MAINTENANCE_FREQUENCIES = ["Monthly", "Quarterly", "Half Yearly", "Yearly"];
const SHIFT_OPTIONS = ["A", "B", "C", "G"];
const MAINTENANCE_TYPE_OPTIONS = ["Preventive", "Predictive", "Overhauling"] as const;
type MaintenanceTypeOption = (typeof MAINTENANCE_TYPE_OPTIONS)[number];
const ALL_MAINTENANCE_TYPE_OPTION = "all-maintenance-type";
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
  type?: string | null;
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
  maintenanceType?: string | null;
  notes?: string | null;
  preNotificationSent: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  machineName?: string | null;
  machineCode?: string | null;
  machineType?: string | null;
  lineName?: string | null;
  emailRecipients?: string | null;
  emailTemplate?: string | null;
  checksheetPath?: string | null;
  completionRemark?: string | null;
  completionAttachmentPath?: string | null;
  previousScheduledDate?: string | null;
}

const normalizeMaintenanceType = (value: string | null | undefined): MaintenanceTypeOption | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = MAINTENANCE_TYPE_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? null;
};

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

async function parseJsonOrThrow<T = unknown>(response: Response): Promise<T | null> {
  const raw = await response.text();
  const text = raw.trim();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const looksLikeHtml = /^<!DOCTYPE/i.test(text) || /^<html/i.test(text);
    if (looksLikeHtml) {
      throw new Error(
        "Server returned HTML instead of JSON. Please refresh the page, ensure you are still signed in, and try again.",
      );
    }

    const snippet = text.length > 180 ? `${text.slice(0, 180).trimEnd()}…` : text;
    throw new Error(snippet || "Server returned a non-JSON response.");
  }
}
export default function MaintenancePlanner() {
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = (user?.role || "").toLowerCase();
  const canDeleteChecksheet = userRole === "admin";
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(() => ({ ...defaultFormState }));
  const [machinePickerOpen, setMachinePickerOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const completionFileInputRef = useRef<HTMLInputElement | null>(null);
  const [completionTarget, setCompletionTarget] = useState<Schedule | null>(null);
  const [completionRemark, setCompletionRemark] = useState("");
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState(ALL_MAINTENANCE_TYPE_OPTION);
  const [searchTerm, setSearchTerm] = useState("");
  const handleToggleForm = () => {
    if (isFormOpen) {
      setMachinePickerOpen(false);
      setCalendarOpen(false);
    }
    setIsFormOpen((prev) => !prev);
  };

  const { data: machines = [] } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });

const machineOptions = useMemo(() => {
  return machines
    .map((machine) => ({
      id: machine.id,
      name: machine.name,
      code: machine.code || "",
      type: machine.type || "",
      frequency: resolveMachineFrequency(machine),
      planYear: resolveMachinePlanYear(machine),
      search: `${machine.name} ${machine.code || ""} ${machine.type || ""}`.toLowerCase(),
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
    mutationFn: async ({
      scheduleId,
      remark,
      file,
    }: {
      scheduleId: string;
      remark: string;
      file: File | null;
    }) => {
      const formData = new FormData();
      formData.append("remark", remark);
      if (file) {
        formData.append("attachment", file);
      }

      const response = await fetch(resolveApiUrl(`/api/maintenance-plans/${scheduleId}/complete`), {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = (await response.text()) || response.statusText;
        throw new Error(errorText);
      }

      return await parseJsonOrThrow(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-plans"] });
      toast({
        title: "Maintenance completed",
        description: "Completion details recorded successfully.",
      });
      resetCompletionDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to complete maintenance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ scheduleId, file }: { scheduleId: string; file: File }) => {
      const formData = new FormData();
      formData.append("checksheet", file);
      const response = await fetch(resolveApiUrl(`/api/maintenance-plans/${scheduleId}/checksheet`), {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = (await response.text()) || response.statusText;
        throw new Error(errorText);
      }

      return await parseJsonOrThrow(response);
    },
    onMutate: ({ scheduleId }) => {
      setUploadingId(scheduleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-plans"] });
      toast({
        title: "Checksheet uploaded",
        description: "The checksheet has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload checksheet",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUploadingId(null);
    },
  });

  const resetCompletionDialog = () => {
    setCompletionTarget(null);
    setCompletionRemark("");
    setCompletionFile(null);
    if (completionFileInputRef.current) {
      completionFileInputRef.current.value = "";
    }
  };

  const handleOpenCompletionDialog = (schedule: Schedule) => {
    setCompletionTarget(schedule);
    setCompletionRemark(schedule.completionRemark?.trim() ?? "");
    setCompletionFile(null);
    if (completionFileInputRef.current) {
      completionFileInputRef.current.value = "";
    }
  };

  const handleFileSelected = (scheduleId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    uploadMutation.mutate({ scheduleId, file });
    event.target.value = "";
  };

  const triggerFileDialog = (scheduleId: string) => {
    const node = fileInputRefs.current[scheduleId];
    node?.click();
  };

  const toSafeFileLabel = (label: string, fallback: string): string => {
    const trimmed = label.trim();
    if (!trimmed) {
      return fallback;
    }
    return trimmed
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60);
  };

  const inferExtension = (filePath?: string | null): string => {
    if (!filePath) {
      return "";
    }
    const lastDot = filePath.lastIndexOf(".");
    if (lastDot === -1 || lastDot === filePath.length - 1) {
      return "";
    }
    return filePath.slice(lastDot);
  };

  const downloadFromApi = async ({
    endpoint,
    fallbackName,
    fallbackExtension,
  }: {
    endpoint: string;
    fallbackName: string;
    fallbackExtension?: string;
  }) => {
    const url = resolveApiUrl(endpoint);
    const response = await fetch(url, { credentials: "include" });

    if (!response.ok) {
      const errorText = (await response.text()) || response.statusText;
      throw new Error(errorText);
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    let filename: string | null = null;

    const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\r\n]+)/i);
    if (filenameMatch?.[1]) {
      const raw = filenameMatch[1].replace(/^["']|["']$/g, "");
      try {
        filename = decodeURIComponent(raw);
      } catch {
        filename = raw;
      }
    }

    const extension =
      filename && filename.includes(".")
        ? ""
        : fallbackExtension && fallbackExtension.startsWith(".")
          ? fallbackExtension
          : "";

    if (!filename) {
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
    setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 0);
  };

  const handleDownloadChecksheet = async (schedule: Schedule) => {
    try {
      const label = toSafeFileLabel(
        schedule.machineCode || schedule.machineName || "checksheet",
        "checksheet",
      );
      await downloadFromApi({
        endpoint: `/api/maintenance-plans/${schedule.id}/checksheet`,
        fallbackName: label,
        fallbackExtension: inferExtension(schedule.checksheetPath),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to download the checksheet";
      toast({
        title: "Failed to download checksheet",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDownloadCompletionAttachment = async (schedule: Schedule) => {
    try {
      const label = toSafeFileLabel(
        schedule.machineCode || schedule.machineName || "completion",
        "completion",
      );
      await downloadFromApi({
        endpoint: `/api/maintenance-plans/${schedule.id}/completion-attachment`,
        fallbackName: `${label}-completion`,
        fallbackExtension: inferExtension(schedule.completionAttachmentPath),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to download the completion document";
      toast({
        title: "Failed to download completion document",
        description: message,
        variant: "destructive",
      });
    }
  };

  const closeCompletionDialog = () => {
    if (completeMutation.isPending) {
      return;
    }
    resetCompletionDialog();
  };

  const handleCompletionFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCompletionFile(file);
  };

  const handleCompletionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!completionTarget) {
      return;
    }

    const trimmedRemark = completionRemark.trim();
    if (!trimmedRemark) {
      toast({
        title: "Remark required",
        description: "Please provide a remark describing the maintenance performed.",
        variant: "destructive",
      });
      return;
    }

    if (!completionFile) {
      toast({
        title: "Attachment required",
        description: "Please attach the completion document before marking the plan as completed.",
        variant: "destructive",
      });
      return;
    }

    completeMutation.mutate({
      scheduleId: completionTarget.id,
      remark: trimmedRemark,
      file: completionFile,
    });
  };

  const handleRemoveChecksheet = async (scheduleId: string, machineName?: string | null) => {
    if (!canDeleteChecksheet) {
      toast({
        title: "Insufficient permissions",
        description: "Only administrators can delete checksheets.",
        variant: "destructive",
      });
      return;
    }

    const label = machineName && machineName.trim().length > 0 ? machineName : "this machine";
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the checksheet for ${label}?`,
    );
    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(resolveApiUrl(`/api/maintenance-plans/${scheduleId}/checksheet`), {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = (await response.text()) || response.statusText;
        throw new Error(errorText);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-plans"] });

      toast({
        title: "Checksheet deleted",
        description: "The checksheet has been removed successfully.",
      });
    } catch (error) {
      toast({
        title: "Failed to delete checksheet",
        description: error instanceof Error ? error.message : "Unable to delete the checksheet",
        variant: "destructive",
      });
    }
  };

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

  const filteredSchedules = useMemo(() => {
    const normalizedStatus = statusFilter.trim().toLowerCase();
    const normalizedType = typeFilter.trim().toLowerCase();
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedMaintenanceType = maintenanceTypeFilter;

    return schedules.filter((schedule) => {
      const scheduleStatus = (schedule.status || "").toLowerCase();
      const matchesStatus = normalizedStatus === "all" || scheduleStatus === normalizedStatus;

      if (!matchesStatus) {
        return false;
      }

      const scheduleType = (schedule.machineType || "").trim().toLowerCase();
      const matchesType =
        normalizedType === "all" ||
        (normalizedType === "__none__" ? scheduleType.length === 0 : scheduleType === normalizedType);

      if (!matchesType) {
        return false;
      }

      const scheduleMaintenanceType = normalizeMaintenanceType(schedule.maintenanceType);
      const matchesMaintenanceType =
        normalizedMaintenanceType === ALL_MAINTENANCE_TYPE_OPTION ||
        scheduleMaintenanceType === normalizedMaintenanceType;

      if (!matchesMaintenanceType) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const candidates = [
        schedule.machineName,
        schedule.machineCode,
        schedule.machineType,
        schedule.maintenanceType,
        schedule.notes,
        schedule.lineName,
        schedule.maintenanceFrequency,
        schedule.completionRemark,
      ];

      return candidates.some((value) => {
        return typeof value === "string" && value.toLowerCase().includes(normalizedSearch);
      });
    });
  }, [schedules, statusFilter, typeFilter, maintenanceTypeFilter, searchTerm]);

  const statusOptions = useMemo(() => {
    const unique = new Set<string>();

    for (const schedule of schedules) {
      if (schedule.status) {
        unique.add(schedule.status.toLowerCase());
      }
    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const typeOptions = useMemo(() => {
    const map = new Map<string, string>();
    let hasMissing = false;

    const registerType = (rawType: unknown) => {
      if (typeof rawType === "string") {
        const trimmed = rawType.trim();
        if (trimmed) {
          const normalized = trimmed.toLowerCase();
          if (!map.has(normalized)) {
            map.set(normalized, trimmed);
          }
          return;
        }
      }
      hasMissing = true;
    };

    for (const machine of machines) {
      registerType(machine.type);
    }

    for (const schedule of schedules) {
      registerType(schedule.machineType);
    }

    const options = Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (hasMissing) {
      options.push({ value: "__none__", label: "No type specified" });
    }

    return options;
  }, [machines, schedules]);

  const sortedSchedules = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => {
      const aDate = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
      const bDate = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
      return aDate - bDate;
    });
  }, [filteredSchedules]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Maintenance Planner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule and track machine maintenance based on frequency targets.
          </p>
        </div>
        <Button
          onClick={handleToggleForm}
          aria-expanded={isFormOpen}
          aria-controls="maintenance-planner-form"
          className="w-full md:w-auto"
          data-testid="button-toggle-maintenance-form"
        >
          {isFormOpen ? "Hide Scheduler Form" : "New Maintenance Plan"}
        </Button>
      </div>

      {isFormOpen ? (
        <Card id="maintenance-planner-form" className="p-6 space-y-4">
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
      ) : null}

      <Card className="p-0">
        <div className="flex flex-col gap-4 border-b border-border p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Scheduled Maintenance</h2>
            <p className="text-sm text-muted-foreground">Filter and review maintenance plans with completion details.</p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted-foreground">Search</span>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search machine, notes, line, or remark…"
                className="w-full md:w-72"
                data-testid="input-maintenance-search"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted-foreground">Status</span>
              <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-status-filter">
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted-foreground">Type</span>
              <Select value={typeFilter} onValueChange={setTypeFilter} data-testid="select-type-filter">
                <SelectTrigger className="w-full md:w-52">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted-foreground">Maintenance Type</span>
              <Select
                value={maintenanceTypeFilter}
                onValueChange={setMaintenanceTypeFilter}
                data-testid="select-maintenance-type-filter"
              >
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="All maintenance types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MAINTENANCE_TYPE_OPTION}>All maintenance types</SelectItem>
                  {MAINTENANCE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setTypeFilter("all");
                setMaintenanceTypeFilter(ALL_MAINTENANCE_TYPE_OPTION);
              }}
              disabled={
                !searchTerm &&
                statusFilter === "all" &&
                typeFilter === "all" &&
                maintenanceTypeFilter === ALL_MAINTENANCE_TYPE_OPTION
              }
              data-testid="button-reset-filters"
            >
              Reset Filters
            </Button>
          </div>
        </div>
        <div className="p-6 pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Machine</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Maintenance Type</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Pre-Reminder Sent</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Completion Remark</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSchedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-muted-foreground">
                  No maintenance plans scheduled.
                </TableCell>
              </TableRow>
            ) : (
              sortedSchedules.map((schedule) => {
                const isUploadingThisRow =
                  uploadMutation.isPending && uploadingId === schedule.id;
                const hasChecksheet =
                  typeof schedule.checksheetPath === "string" &&
                  schedule.checksheetPath.trim().length > 0;
                const hasCompletionAttachment =
                  typeof schedule.completionAttachmentPath === "string" &&
                  schedule.completionAttachmentPath.trim().length > 0;
                const maintenanceTypeLabel = normalizeMaintenanceType(schedule.maintenanceType) ?? "-";

                return (
                  <TableRow key={schedule.id} data-testid={`row-maintenance-${schedule.id}`}>
                  <TableCell>
                    <div className="font-medium">{schedule.machineName || "Unknown Machine"}</div>
                    <div className="text-xs text-muted-foreground">{schedule.machineCode || "-"}</div>
                  </TableCell>
                  <TableCell>{schedule.lineName || "-"}</TableCell>
                  <TableCell>{schedule.machineType || "-"}</TableCell>
                  <TableCell>{formatDateSafe(schedule.scheduledDate)}</TableCell>
                  <TableCell>{schedule.shift || "-"}</TableCell>
                  <TableCell className="capitalize">{schedule.status}</TableCell>
                  <TableCell>{schedule.maintenanceFrequency || "-"}</TableCell>
                  <TableCell>{maintenanceTypeLabel}</TableCell>
                  <TableCell className="max-w-[200px] whitespace-pre-wrap">
                    {schedule.emailRecipients?.length
                      ? schedule.emailRecipients
                      : "Default recipients"}
                  </TableCell>
                  <TableCell className="max-w-[220px]">{schedule.notes || "-"}</TableCell>
                  <TableCell>{schedule.preNotificationSent ? "Yes" : "No"}</TableCell>
                  <TableCell>{schedule.completedAt ? formatDateSafe(schedule.completedAt) : "-"}</TableCell>
                  <TableCell className="max-w-[240px] whitespace-pre-wrap">
                    {schedule.completionRemark && schedule.completionRemark.trim().length > 0
                      ? schedule.completionRemark
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={(node) => {
                          fileInputRefs.current[schedule.id] = node;
                        }}
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        className="hidden"
                        onChange={(event) => handleFileSelected(schedule.id, event)}
                      />
                      {hasChecksheet ? (
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void handleDownloadChecksheet(schedule);
                            }}
                            data-testid={`button-download-checksheet-${schedule.id}`}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download Checksheet
                          </Button>
                          {canDeleteChecksheet ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemoveChecksheet(schedule.id, schedule.machineName)}
                              disabled={uploadMutation.isPending}
                              data-testid={`button-remove-checksheet-${schedule.id}`}
                            >
                              Delete Checksheet
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => triggerFileDialog(schedule.id)}
                          disabled={isUploadingThisRow}
                          data-testid={`button-upload-checksheet-${schedule.id}`}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {isUploadingThisRow ? "Uploading..." : "Upload Checksheet"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenCompletionDialog(schedule)}
                        disabled={schedule.status === "completed" || completeMutation.isPending}
                        data-testid={`button-complete-maintenance-${schedule.id}`}
                      >
                        Mark Completed
                      </Button>
                      {schedule.status === "completed" && hasCompletionAttachment ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            void handleDownloadCompletionAttachment(schedule);
                          }}
                          data-testid={`button-download-completion-${schedule.id}`}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          View Completion Doc
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </Card>
      <Dialog
        open={completionTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeCompletionDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Maintenance</DialogTitle>
            <DialogDescription>
              Provide completion details for {completionTarget?.machineName || "this machine"}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCompletionSubmit}>
            <div className="space-y-2">
              <Label htmlFor="completion-remark">
                Completion Remark <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="completion-remark"
                value={completionRemark}
                onChange={(event) => setCompletionRemark(event.target.value)}
                rows={4}
                placeholder="Summarize the maintenance work performed."
                disabled={completeMutation.isPending}
                data-testid="textarea-completion-remark"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="completion-attachment">
                Completion Document <span className="text-destructive">*</span>
              </Label>
              <Input
                id="completion-attachment"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={handleCompletionFileChange}
                ref={completionFileInputRef}
                disabled={completeMutation.isPending}
                data-testid="input-completion-attachment"
              />
              <p className="text-xs text-muted-foreground">
                Attach evidence of the completed work. Accepted formats: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG.
              </p>
              {completionFile ? (
                <p className="text-xs font-medium text-muted-foreground">{completionFile.name}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeCompletionDialog}
                disabled={completeMutation.isPending}
                data-testid="button-cancel-completion"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={completeMutation.isPending || !completionFile}
                data-testid="button-confirm-completion"
              >
                {completeMutation.isPending ? "Marking..." : "Confirm Completion"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}




