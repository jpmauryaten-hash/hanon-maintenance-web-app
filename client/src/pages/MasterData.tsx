import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Upload, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import * as XLSX from "xlsx";

type BulkImportRecord = {
  lineName: string;
  subLineName?: string;
  machineName?: string;
  machineCode?: string;
  machineType?: string;
  maintenanceFrequency?: string;
  pmPlanYear?: string;
  uptime?: string;
};

type ProblemTypeImportRecord = {
  name: string;
  description?: string;
};

type EmployeeImportRecord = {
  name: string;
  role?: string;
  department?: string;
};

type BulkMachineDraft = {
  name: string;
  code: string;
  type: string;
  maintenanceFrequency: string;
  pmPlanYear: string;
  uptime: string;
};

type MachineBreakdownEntry = {
  id: string;
  date: string | null;
  shift: string | null;
  status: string | null;
  problemDescription: string | null;
  totalMinutes: number | null;
  machineName?: string | null;
};

const MACHINE_CODE_STORAGE_KEY = "master-data-machine-codes";
const MAINTENANCE_FREQUENCIES = ["Monthly", "Quarterly", "Half Yearly", "Yearly"];
const PAGE_SIZE = 15;

const normalizeMaintenanceFrequencyLabel = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/[-_]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  const match = MAINTENANCE_FREQUENCIES.find(
    (option) => option.replace(/\s+/g, " ").toLowerCase() === normalized,
  );
  return match ?? trimmed;
};

const resolveMachineCode = (machine: any, overrides: Record<string, string> = {}): string => {
  if (machine?.id && overrides[machine.id]) {
    return overrides[machine.id];
  }

  const candidates = [
    machine?.code,
    machine?.machineCode,
    machine?.machine_code,
    machine?.machinecode,
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

const resolveLineId = (machine: any): string | null => {
  const candidates = [machine?.lineId, machine?.line_id, machine?.lineID];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
};

const resolveSubLineId = (machine: any): string | null => {
  const candidates = [
    machine?.subLineId,
    machine?.sub_line_id,
    machine?.sublineId,
    machine?.subline_id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
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
        return normalizeMaintenanceFrequencyLabel(trimmed);
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

const resolveUptime = (machine: any): string => {
  const candidates = [machine?.uptime, machine?.machineUptime, machine?.machine_uptime];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) {
      continue;
    }
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return String(numeric);
    }
    if (typeof candidate === "string") {
      const match = candidate.match(/\d+/);
      if (match) {
        return match[0];
      }
    }
  }
  return "";
};

const normalizeUptimeValue = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const str = String(value).trim();
  if (str.length === 0) return null;
  const match = str.match(/\d+/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
};



export default function MasterData() {
  const parseJsonResponse = useCallback(async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    const text = await res.text();
    throw new Error(text || "Unexpected non-JSON response from server");
  }, []);

  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("lines");
  const [isAddLineDialogOpen, setIsAddLineDialogOpen] = useState(false);
  const [isAddSubLineDialogOpen, setIsAddSubLineDialogOpen] = useState(false);
  const [isAddMachineDialogOpen, setIsAddMachineDialogOpen] = useState(false);
  const [isAddEmployeeDialogOpen, setIsAddEmployeeDialogOpen] = useState(false);
  const [isAddProblemDialogOpen, setIsAddProblemDialogOpen] = useState(false);
  const [isAddCapaCategoryDialogOpen, setIsAddCapaCategoryDialogOpen] = useState(false);
  const [lineForm, setLineForm] = useState({ name: "", description: "" });
  const [subLineForm, setSubLineForm] = useState({ name: "", lineId: "" });
  const [machineForm, setMachineForm] = useState({
    name: "",
    code: "",
    lineId: "",
    subLineId: "",
    type: "",
    maintenanceFrequency: "",
    pmPlanYear: "",
    uptime: "",
  });
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    role: "",
    department: "",
  });
  const [problemForm, setProblemForm] = useState({
    name: "",
    description: "",
  });
  const [capaCategoryForm, setCapaCategoryForm] = useState({
    name: "",
  });
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingSubLineId, setEditingSubLineId] = useState<string | null>(null);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editingCapaCategoryId, setEditingCapaCategoryId] = useState<string | null>(null);
  const [lineSearch, setLineSearch] = useState("");
  const [subLineSearch, setSubLineSearch] = useState("");
  const [machineSearch, setMachineSearch] = useState("");
  const [machineFrequencyFilter, setMachineFrequencyFilter] = useState("all");
  const [machinePmPlanYearFilter, setMachinePmPlanYearFilter] = useState("");
  const [machineUptimeFilter, setMachineUptimeFilter] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [problemSearch, setProblemSearch] = useState("");
  const [capaCategorySearch, setCapaCategorySearch] = useState("");
  const [linePage, setLinePage] = useState(1);
  const [subLinePage, setSubLinePage] = useState(1);
  const [machinePage, setMachinePage] = useState(1);
  const [employeePage, setEmployeePage] = useState(1);
  const [problemPage, setProblemPage] = useState(1);
  const [capaCategoryPage, setCapaCategoryPage] = useState(1);
  const [machineDeleteBlock, setMachineDeleteBlock] = useState<{
    machine: any | null;
    breakdowns: MachineBreakdownEntry[];
  } | null>(null);
  const [machineCodeOverrides, setMachineCodeOverrides] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const stored = window.localStorage.getItem(MACHINE_CODE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [isMachineBulkEditMode, setIsMachineBulkEditMode] = useState(false);
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
  const [bulkMachineDrafts, setBulkMachineDrafts] = useState<Record<string, BulkMachineDraft>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const problemFileInputRef = useRef<HTMLInputElement>(null);
  const employeeFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  useEffect(() => {
    if (typeof location !== "string" || !location.startsWith("/master")) {
      return;
    }
    try {
      const [, queryString = ""] = location.split("?");
      const params = new URLSearchParams(queryString);
      const nextTab = params.get("tab") || "lines";
      setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
    } catch {
      setActiveTab("lines");
    }
  }, [location]);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      const [path, queryString = ""] =
        typeof location === "string" && location.includes("?")
          ? location.split("?")
          : [location || "/master", ""];
      const params = new URLSearchParams(queryString);
      if (value === "lines") {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      const nextQuery = params.toString();
      const basePath = path || "/master";
      const nextPath = nextQuery ? `${basePath}?${nextQuery}` : basePath;
      if (nextPath !== location) {
        setLocation(nextPath, { replace: true });
      }
    },
    [location, setLocation],
  );

  const { data: lines = [], isLoading: linesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/lines"] 
  });

  const { data: subLines = [], isLoading: subLinesLoading } = useQuery<any[]>({
    queryKey: ["/api/sub-lines"],
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/machines"] 
  });

  const { data: machineBreakdownUsage = {}, isLoading: machineBreakdownUsageLoading } = useQuery<Record<string, MachineBreakdownEntry[]>>({
    queryKey: ["/api/machines/breakdown-usage"],
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/employees"] 
  });

  const { data: problemTypes = [], isLoading: problemTypesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/problem-types"] 
  });
  const { data: capaCategories = [], isLoading: capaCategoriesLoading } = useQuery<any[]>({
    queryKey: ["/api/capa-categories"],
  });

  const addLineMutation = useMutation({
    mutationFn: async (data: typeof lineForm) => {
      const res = await apiRequest("POST", "/api/lines", data);
      return await parseJsonResponse(res);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<any[]>(["/api/lines"], (old) =>
        old ? [...old, created] : [created],
      );
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      setLineForm({ name: "", description: "" });
      setEditingLineId(null);
      setIsAddLineDialogOpen(false);
      toast({
        title: "Line Created",
        description: "The new line has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create line",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof lineForm }) => {
      const res = await apiRequest("PUT", `/api/lines/${id}`, data);
      return await parseJsonResponse(res);
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<any[]>(["/api/lines"], (old) =>
        old ? old.map((item) => (item.id === variables.id ? { ...item, ...updated } : item)) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      setLineForm({ name: "", description: "" });
      setEditingLineId(null);
      setIsAddLineDialogOpen(false);
      toast({
        title: "Line Updated",
        description: "The line has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update line",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/lines/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<any[]>(["/api/lines"], (old) =>
        old ? old.filter((line) => line.id !== id) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      toast({
        title: "Line Deleted",
        description: "The line has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete line",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLineDialogChange = (open: boolean) => {
    setIsAddLineDialogOpen(open);
    if (!open) {
      setLineForm({ name: "", description: "" });
      addLineMutation.reset();
      updateLineMutation.reset();
      setEditingLineId(null);
    }
  };

  const handleAddLineSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingLineId) {
      updateLineMutation.mutate({ id: editingLineId, data: lineForm });
    } else {
      addLineMutation.mutate(lineForm);
    }
  };

  const handleStartCreateLine = () => {
    setEditingLineId(null);
    setLineForm({ name: "", description: "" });
    setIsAddLineDialogOpen(true);
  };

  const handleEditLine = (line: any) => {
    setEditingLineId(line.id);
    setLineForm({
      name: line.name || "",
      description: line.description || "",
    });
    setIsAddLineDialogOpen(true);
  };

  const handleDeleteLine = (line: any) => {
    if (!isAdmin || deleteLineMutation.isPending) return;
    const confirmed = window.confirm(`Delete line "${line.name}"? This cannot be undone.`);
    if (!confirmed) return;
    deleteLineMutation.mutate(line.id);
  };

  const addSubLineMutation = useMutation({
    mutationFn: async (data: typeof subLineForm) => {
      const res = await apiRequest("POST", "/api/sub-lines", data);
      return await parseJsonResponse(res);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<any[]>(["/api/sub-lines"], (old) =>
        old ? [...old, created] : [created],
      );
      queryClient.invalidateQueries({ queryKey: ["/api/sub-lines"] });
      toast({
        title: "Sub Line Created",
        description: "The new sub line has been added successfully.",
      });
      setSubLineForm({ name: "", lineId: "" });
      setEditingSubLineId(null);
      setIsAddSubLineDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create sub line",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSubLineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof subLineForm }) => {
      const res = await apiRequest("PUT", `/api/sub-lines/${id}`, data);
      return await parseJsonResponse(res);
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<any[]>(["/api/sub-lines"], (old) =>
        old ? old.map((item) => (item.id === variables.id ? { ...item, ...updated } : item)) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/sub-lines"] });
      setSubLineForm({ name: "", lineId: "" });
      setEditingSubLineId(null);
      setIsAddSubLineDialogOpen(false);
      toast({
        title: "Sub Line Updated",
        description: "The sub line has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update sub line",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSubLineMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sub-lines/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<any[]>(["/api/sub-lines"], (old) =>
        old ? old.filter((item) => item.id !== id) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/sub-lines"] });
      if (editingSubLineId === id) {
        setEditingSubLineId(null);
        setIsAddSubLineDialogOpen(false);
        setSubLineForm({ name: "", lineId: "" });
      }
      toast({
        title: "Sub Line Deleted",
        description: "The sub line has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete sub line",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubLineDialogChange = (open: boolean) => {
    setIsAddSubLineDialogOpen(open);
    if (!open) {
      setSubLineForm({ name: "", lineId: "" });
      addSubLineMutation.reset();
      updateSubLineMutation.reset();
      deleteSubLineMutation.reset();
      setEditingSubLineId(null);
    }
  };

  const handleAddSubLineSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingSubLineId) {
      updateSubLineMutation.mutate({ id: editingSubLineId, data: subLineForm });
    } else {
      addSubLineMutation.mutate(subLineForm);
    }
  };

  const handleStartCreateSubLine = () => {
    setEditingSubLineId(null);
    setSubLineForm({ name: "", lineId: "" });
    setIsAddSubLineDialogOpen(true);
  };

  const handleEditSubLine = (subLine: any) => {
    setEditingSubLineId(subLine.id);
    setSubLineForm({
      name: subLine.name || "",
      lineId: subLine.lineId || "",
    });
    setIsAddSubLineDialogOpen(true);
  };

  const handleDeleteSubLine = (subLine: any) => {
    if (!isAdmin || deleteSubLineMutation.isPending) {
      return;
    }
    const confirmed = window.confirm(
      `Delete sub line "${subLine.name}"? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    deleteSubLineMutation.mutate(subLine.id);
  };

  const persistMachineCodeOverrides = useCallback((overrides: Record<string, string>) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MACHINE_CODE_STORAGE_KEY, JSON.stringify(overrides));
    }
  }, []);

  const updateMachineCodeOverride = useCallback(
    (id: string, code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) return;
      setMachineCodeOverrides((prev) => {
        if (prev[id] === normalized) {
          return prev;
        }
        const next = { ...prev, [id]: normalized };
        persistMachineCodeOverrides(next);
        return next;
      });
    },
    [persistMachineCodeOverrides]
  );

  const addMachineMutation = useMutation({
    mutationFn: async (data: typeof machineForm) => {
      const payload = {
        ...data,
        maintenanceFrequency: (data.maintenanceFrequency || "").trim() || null,
        pmPlanYear: (data.pmPlanYear || "").trim() || null,
        uptime: normalizeUptimeValue(data.uptime),
      };
      const response = await apiRequest("POST", "/api/machines", payload);
      return await parseJsonResponse(response);
    },
    onSuccess: (machine: any, variables) => {
      const submittedCode = (variables.code || "").trim().toUpperCase();
      const returnedCode = resolveMachineCode(machine, machineCodeOverrides);
      const normalizedCode = (returnedCode || submittedCode).trim().toUpperCase();
      const effectiveUpdatedCode = normalizedCode || submittedCode;
      const effectiveCode = normalizedCode || submittedCode;
      const machineLineId = resolveLineId(machine) ?? variables.lineId;
      const machineSubLineId = resolveSubLineId(machine) ?? variables.subLineId;
      const submittedFrequency = (variables.maintenanceFrequency || "").trim();
      const returnedFrequency = resolveMaintenanceFrequency(machine);
      const normalizedFrequency = (returnedFrequency || submittedFrequency).trim();
      const finalFrequency = normalizedFrequency !== "" ? normalizedFrequency : null;
      const submittedPlan = (variables.pmPlanYear || "").trim();
      const returnedPlan = resolvePmPlanYear(machine);
      const normalizedPlan = (returnedPlan || submittedPlan).trim();
      const finalPlan = normalizedPlan !== "" ? normalizedPlan : null;
      const submittedUptime = normalizeUptimeValue(variables.uptime);
      const returnedUptime = normalizeUptimeValue(machine?.uptime);
      const finalUptime = returnedUptime ?? submittedUptime ?? null;

      const machineWithCode = {
        ...machine,
        code: effectiveCode || machine.code,
        machineCode: effectiveCode || machine.machineCode,
        machine_code: effectiveCode || machine.machine_code,
        maintenanceFrequency: finalFrequency,
        maintenance_frequency: finalFrequency,
        pmPlanYear: finalPlan,
        pm_plan_year: finalPlan,
        uptime: finalUptime,
        lineId: machineLineId,
        line_id: machineLineId,
        subLineId: machineSubLineId,
        sub_line_id: machineSubLineId,
        type: machine.type ?? variables.type ?? null,
      };

      queryClient.setQueryData<any[]>(["/api/machines"], (old) => {
        if (!old) return old;
        return [...old, machineWithCode];
      });

      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      setMachineForm({ name: "", code: "", lineId: "", subLineId: "", type: "", maintenanceFrequency: "", pmPlanYear: "", uptime: "" });
      setIsAddMachineDialogOpen(false);
      setEditingMachineId(null);
      toast({
        title: "Machine Created",
        description: "The new machine has been added successfully.",
      });

      if (machineWithCode?.id && (effectiveCode || normalizedCode).length > 0) {
        updateMachineCodeOverride(machineWithCode.id, effectiveCode || normalizedCode);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create machine",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMachineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof machineForm }) => {
      const payload = {
        ...data,
        maintenanceFrequency: (data.maintenanceFrequency || "").trim() || null,
        pmPlanYear: (data.pmPlanYear || "").trim() || null,
        uptime: normalizeUptimeValue(data.uptime),
      };
      const response = await apiRequest("PUT", `/api/machines/${id}`, payload);
      return await parseJsonResponse(response);
    },
    onSuccess: (machine: any, variables) => {
      const { id, data } = variables;
      const submittedCode = (data.code || "").trim().toUpperCase();
      const returnedCode = resolveMachineCode(machine, machineCodeOverrides);
      const normalizedCode = (returnedCode || submittedCode).trim().toUpperCase();
      const submittedFrequency = (data.maintenanceFrequency || "").trim();
      const returnedFrequency = resolveMaintenanceFrequency(machine);
      const normalizedFrequency = (returnedFrequency || submittedFrequency).trim();
      const finalFrequency = normalizedFrequency !== "" ? normalizedFrequency : null;
      const submittedPlan = (data.pmPlanYear || "").trim();
      const returnedPlan = resolvePmPlanYear(machine);
      const normalizedPlan = (returnedPlan || submittedPlan).trim();
      const finalPlan = normalizedPlan !== "" ? normalizedPlan : null;
      const submittedUptime = normalizeUptimeValue(data.uptime);
      const returnedUptime = normalizeUptimeValue(machine?.uptime);
      const finalUptime = returnedUptime ?? submittedUptime ?? null;
      const machineLineId = resolveLineId(machine) ?? data.lineId;
      const machineSubLineId = resolveSubLineId(machine) ?? data.subLineId;
      const effectiveUpdatedCode = normalizedCode || submittedCode;

      queryClient.setQueryData<any[]>(["/api/machines"], (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === id
            ? {
                ...item,
                name: data.name,
                code: effectiveUpdatedCode || item.code,
                machineCode: effectiveUpdatedCode || item.machineCode,
                machine_code: effectiveUpdatedCode || item.machine_code,
                maintenanceFrequency: finalFrequency,
                maintenance_frequency: finalFrequency,
                pmPlanYear: finalPlan,
                pm_plan_year: finalPlan,
                uptime: finalUptime,
                lineId: machineLineId,
                line_id: machineLineId,
                subLineId: machineSubLineId,
                sub_line_id: machineSubLineId,
                type: data.type,
              }
            : item
        );
      });

      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });

      setMachineForm({ name: "", code: "", lineId: "", subLineId: "", type: "", maintenanceFrequency: "", pmPlanYear: "", uptime: "" });
      setEditingMachineId(null);
      setIsAddMachineDialogOpen(false);
      toast({
        title: "Machine Updated",
        description: "The machine details have been saved.",
      });

      if (effectiveUpdatedCode.length > 0) {
        updateMachineCodeOverride(id, effectiveUpdatedCode);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update machine",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkUpdateMachinesMutation = useMutation({
    mutationFn: async (machineIds: string[]) => {
      const machineMap = new Map(machines.map((machine: any) => [machine.id, machine]));
      for (const id of machineIds) {
        const machine = machineMap.get(id);
        const draft = bulkMachineDrafts[id];
        if (!machine || !draft) {
          continue;
        }

        const lineId = resolveLineId(machine) || "";
        const subLineId = resolveSubLineId(machine) || "";

        await apiRequest("PUT", `/api/machines/${id}`, {
          name: draft.name.trim(),
          code: draft.code.trim().toUpperCase(),
          lineId,
          subLineId,
          type: draft.type.trim() || null,
          maintenanceFrequency: draft.maintenanceFrequency.trim() || null,
          pmPlanYear: draft.pmPlanYear.trim() || null,
          uptime: normalizeUptimeValue(draft.uptime),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      setSelectedMachineIds([]);
      setIsMachineBulkEditMode(false);
      toast({
        title: "Machines Updated",
        description: "Selected machines were updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to bulk update machines",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMachineMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/machines/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<any[]>(["/api/machines"], (old) =>
        old ? old.filter((machine) => machine.id !== id) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines/breakdown-usage"] });
      toast({
        title: "Machine Deleted",
        description: "The machine has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete machine",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMachinesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await apiRequest("DELETE", `/api/machines/${id}`);
      }
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.setQueryData<any[]>(["/api/machines"], (old) =>
        old ? old.filter((machine) => !ids.includes(machine.id)) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines/breakdown-usage"] });
      setSelectedMachineIds([]);
      setIsMachineBulkEditMode(false);
      toast({
        title: "Machines Deleted",
        description: `${ids.length} selected machine${ids.length === 1 ? "" : "s"} removed.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete selected machines",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMachineDialogChange = (open: boolean) => {
    setIsAddMachineDialogOpen(open);
    if (!open) {
      setMachineForm({ name: "", code: "", lineId: "", subLineId: "", type: "", maintenanceFrequency: "", pmPlanYear: "", uptime: "" });
      addMachineMutation.reset();
      updateMachineMutation.reset();
      setEditingMachineId(null);
    }
  };

  const handleAddMachineSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingMachineId) {
      updateMachineMutation.mutate({ id: editingMachineId, data: machineForm });
    } else {
      addMachineMutation.mutate(machineForm);
    }
  };

  const handleEditMachine = (machine: any) => {
    const fallbackCode = resolveMachineCode(machine, machineCodeOverrides);
    const fallbackLineId = resolveLineId(machine) || "";
    const fallbackSubLineId = resolveSubLineId(machine) || "";
    const fallbackFrequency = resolveMaintenanceFrequency(machine);
    const fallbackPlan = resolvePmPlanYear(machine);
    const fallbackUptime = resolveUptime(machine);
    setMachineForm({
      name: machine.name || "",
      code: fallbackCode.toUpperCase(),
      lineId: fallbackLineId,
      subLineId: fallbackSubLineId,
      type: machine.type || "",
      maintenanceFrequency: fallbackFrequency || "",
      pmPlanYear: fallbackPlan || "",
      uptime: fallbackUptime || "",
    });
    setEditingMachineId(machine.id);
    setIsAddMachineDialogOpen(true);
  };

  const handleDeleteMachine = (machine: any) => {
    if (!isAdmin || deleteMachineMutation.isPending) return;
    const linkedBreakdowns = machineBreakdownUsage[machine.id] ?? [];
    if (linkedBreakdowns.length > 0) {
      setMachineDeleteBlock({
        machine,
        breakdowns: linkedBreakdowns.map((breakdown) => ({
          ...breakdown,
          machineName: machine.name || resolveMachineCode(machine, machineCodeOverrides) || "-",
        })),
      });
      return;
    }
    const confirmed = window.confirm(
      `Delete machine "${machine.name || resolveMachineCode(machine, machineCodeOverrides) || ""}"? This cannot be undone.`
    );
    if (!confirmed) return;
    deleteMachineMutation.mutate(machine.id);
  };

  const handleBulkDeleteMachines = () => {
    if (!isAdmin || bulkDeleteMachinesMutation.isPending) return;
    if (selectedMachineIds.length === 0) {
      toast({
        title: "No machines selected",
        description: "Select at least one machine to delete.",
        variant: "destructive",
      });
      return;
    }

    const machineMap = new Map(machines.map((machine: any) => [machine.id, machine]));
    const blockedBreakdowns = selectedMachineIds.flatMap((id) => {
      const machine = machineMap.get(id);
      const machineName = machine?.name || resolveMachineCode(machine, machineCodeOverrides) || "-";
      return (machineBreakdownUsage[id] ?? []).map((breakdown) => ({
        ...breakdown,
        machineName,
      }));
    });

    if (blockedBreakdowns.length > 0) {
      setMachineDeleteBlock({
        machine: null,
        breakdowns: blockedBreakdowns,
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedMachineIds.length} selected machine${selectedMachineIds.length === 1 ? "" : "s"}? This cannot be undone.`
    );
    if (!confirmed) return;
    bulkDeleteMachinesMutation.mutate(selectedMachineIds);
  };

  const formatBreakdownDate = (value: string | null) => {
    if (!value) return "-";
    const [year, month, day] = value.slice(0, 10).split("-");
    return year && month && day ? `${day}-${month}-${year}` : value;
  };

  const handleToggleMachineBulkMode = () => {
    setIsMachineBulkEditMode((prev) => !prev);
    setSelectedMachineIds([]);
  };

  const handleCancelMachineBulkMode = () => {
    setIsMachineBulkEditMode(false);
    setSelectedMachineIds([]);
  };

  const handleToggleMachineSelection = (id: string, checked: boolean) => {
    setSelectedMachineIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((value) => value !== id),
    );
  };

  const handleSelectAllMachinesOnPage = (checked: boolean) => {
    const currentPageIds = pagedMachines.map((machine: any) => machine.id);
    if (!checked) {
      setSelectedMachineIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
      return;
    }
    setSelectedMachineIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
  };

  const handleBulkMachineFieldChange = (
    machineId: string,
    field: keyof BulkMachineDraft,
    value: string,
  ) => {
    setBulkMachineDrafts((prev) => ({
      ...prev,
      [machineId]: {
        ...prev[machineId],
        [field]: value,
      },
    }));
  };

  const handleSaveBulkMachineEdits = () => {
    if (selectedMachineIds.length === 0) {
      toast({
        title: "No machines selected",
        description: "Select at least one machine to bulk update.",
        variant: "destructive",
      });
      return;
    }

    const hasInvalid = selectedMachineIds.some((id) => {
      const draft = bulkMachineDrafts[id];
      return !draft || !draft.name.trim() || !draft.code.trim();
    });

    if (hasInvalid) {
      toast({
        title: "Missing required fields",
        description: "Machine Name and Machine Code are required for all selected rows.",
        variant: "destructive",
      });
      return;
    }

    bulkUpdateMachinesMutation.mutate(selectedMachineIds);
  };

  const addEmployeeMutation = useMutation({
    mutationFn: async (data: typeof employeeForm) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return await parseJsonResponse(res);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<any[]>(["/api/employees"], (old) =>
        old ? [...old, created] : [created],
      );
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setEmployeeForm({ name: "", role: "", department: "" });
      setEditingEmployeeId(null);
      setIsAddEmployeeDialogOpen(false);
      toast({
        title: "Employee Created",
        description: "The new employee has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create employee",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof employeeForm }) => {
      const res = await apiRequest("PUT", `/api/employees/${id}`, data);
      return await parseJsonResponse(res);
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<any[]>(["/api/employees"], (old) =>
        old ? old.map((item) => (item.id === variables.id ? { ...item, ...updated } : item)) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setEmployeeForm({ name: "", role: "", department: "" });
      setEditingEmployeeId(null);
      setIsAddEmployeeDialogOpen(false);
      toast({
        title: "Employee Updated",
        description: "The employee details have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update employee",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<any[]>(["/api/employees"], (old) =>
        old ? old.filter((item) => item.id !== id) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Employee Deleted",
        description: "The employee has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete employee",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEmployeeDialogChange = (open: boolean) => {
    setIsAddEmployeeDialogOpen(open);
    if (!open) {
      setEmployeeForm({ name: "", role: "", department: "" });
      addEmployeeMutation.reset();
      updateEmployeeMutation.reset();
      setEditingEmployeeId(null);
    }
  };

  const handleAddEmployeeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingEmployeeId) {
      updateEmployeeMutation.mutate({ id: editingEmployeeId, data: employeeForm });
    } else {
      addEmployeeMutation.mutate(employeeForm);
    }
  };

  const handleStartCreateEmployee = () => {
    setEditingEmployeeId(null);
    setEmployeeForm({ name: "", role: "", department: "" });
    setIsAddEmployeeDialogOpen(true);
  };

  const handleEditEmployee = (employee: any) => {
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      name: employee.name || "",
      role: employee.role || "",
      department: employee.department || "",
    });
    setIsAddEmployeeDialogOpen(true);
  };

  const handleDeleteEmployee = (employee: any) => {
    if (!isAdmin || deleteEmployeeMutation.isPending) return;
    const confirmed = window.confirm(`Delete employee "${employee.name}"? This cannot be undone.`);
    if (!confirmed) return;
    deleteEmployeeMutation.mutate(employee.id);
  };

  const addProblemMutation = useMutation({
    mutationFn: async (data: typeof problemForm) => {
      const res = await apiRequest("POST", "/api/problem-types", data);
      return await parseJsonResponse(res);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<any[]>(["/api/problem-types"], (old) =>
        old ? [...old, created] : [created],
      );
      queryClient.invalidateQueries({ queryKey: ["/api/problem-types"] });
      setProblemForm({ name: "", description: "" });
      setEditingProblemId(null);
      setIsAddProblemDialogOpen(false);
      toast({
        title: "Problem Type Created",
        description: "The new problem type has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create problem type",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProblemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof problemForm }) => {
      const res = await apiRequest("PUT", `/api/problem-types/${id}`, data);
      return await parseJsonResponse(res);
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<any[]>(["/api/problem-types"], (old) =>
        old ? old.map((item) => (item.id === variables.id ? { ...item, ...updated } : item)) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/problem-types"] });
      setProblemForm({ name: "", description: "" });
      setEditingProblemId(null);
      setIsAddProblemDialogOpen(false);
      toast({
        title: "Problem Type Updated",
        description: "The problem type has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update problem type",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProblemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/problem-types/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<any[]>(["/api/problem-types"], (old) =>
        old ? old.filter((item) => item.id !== id) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/problem-types"] });
      toast({
        title: "Problem Type Deleted",
        description: "The problem type has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete problem type",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProblemDialogChange = (open: boolean) => {
    setIsAddProblemDialogOpen(open);
    if (!open) {
      setProblemForm({ name: "", description: "" });
      addProblemMutation.reset();
      updateProblemMutation.reset();
      setEditingProblemId(null);
    }
  };

  const handleAddProblemSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingProblemId) {
      updateProblemMutation.mutate({ id: editingProblemId, data: problemForm });
    } else {
      addProblemMutation.mutate(problemForm);
    }
  };

  const handleStartCreateProblem = () => {
    setEditingProblemId(null);
    setProblemForm({ name: "", description: "" });
    setIsAddProblemDialogOpen(true);
  };

  const handleEditProblem = (problem: any) => {
    setEditingProblemId(problem.id);
    setProblemForm({
      name: problem.name || "",
      description: problem.description || "",
    });
    setIsAddProblemDialogOpen(true);
  };

  const handleDeleteProblem = (problem: any) => {
    if (!isAdmin || deleteProblemMutation.isPending) return;
    const confirmed = window.confirm(`Delete problem type "${problem.name}"? This cannot be undone.`);
    if (!confirmed) return;
    deleteProblemMutation.mutate(problem.id);
  };

  const addCapaCategoryMutation = useMutation({
    mutationFn: async (data: typeof capaCategoryForm) => {
      const res = await apiRequest("POST", "/api/capa-categories", data);
      return await parseJsonResponse(res);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<any[]>(["/api/capa-categories"], (old) =>
        old ? [...old, created] : [created],
      );
      queryClient.invalidateQueries({ queryKey: ["/api/capa-categories"] });
      setCapaCategoryForm({ name: "" });
      setEditingCapaCategoryId(null);
      setIsAddCapaCategoryDialogOpen(false);
      toast({
        title: "CAPA Category Created",
        description: "The new CAPA category has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create CAPA category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCapaCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof capaCategoryForm }) => {
      const res = await apiRequest("PUT", `/api/capa-categories/${id}`, data);
      return await parseJsonResponse(res);
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<any[]>(["/api/capa-categories"], (old) =>
        old ? old.map((item) => (item.id === variables.id ? { ...item, ...updated } : item)) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/capa-categories"] });
      setCapaCategoryForm({ name: "" });
      setEditingCapaCategoryId(null);
      setIsAddCapaCategoryDialogOpen(false);
      toast({
        title: "CAPA Category Updated",
        description: "The CAPA category has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update CAPA category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCapaCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/capa-categories/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<any[]>(["/api/capa-categories"], (old) =>
        old ? old.filter((item) => item.id !== id) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/capa-categories"] });
      toast({
        title: "CAPA Category Deleted",
        description: "The CAPA category has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete CAPA category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCapaCategoryDialogChange = (open: boolean) => {
    setIsAddCapaCategoryDialogOpen(open);
    if (!open) {
      setCapaCategoryForm({ name: "" });
      addCapaCategoryMutation.reset();
      updateCapaCategoryMutation.reset();
      setEditingCapaCategoryId(null);
    }
  };

  const handleAddCapaCategorySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingCapaCategoryId) {
      updateCapaCategoryMutation.mutate({ id: editingCapaCategoryId, data: capaCategoryForm });
    } else {
      addCapaCategoryMutation.mutate(capaCategoryForm);
    }
  };

  const handleStartCreateCapaCategory = () => {
    setEditingCapaCategoryId(null);
    setCapaCategoryForm({ name: "" });
    setIsAddCapaCategoryDialogOpen(true);
  };

  const handleEditCapaCategory = (category: any) => {
    setEditingCapaCategoryId(category.id);
    setCapaCategoryForm({ name: category.name || "" });
    setIsAddCapaCategoryDialogOpen(true);
  };

  const handleDeleteCapaCategory = (category: any) => {
    if (!isAdmin || deleteCapaCategoryMutation.isPending) return;
    const confirmed = window.confirm(`Delete CAPA category "${category.name}"? This cannot be undone.`);
    if (!confirmed) return;
    deleteCapaCategoryMutation.mutate(category.id);
  };

  const bulkImportMutation = useMutation<any, Error, BulkImportRecord[]>({
    mutationFn: async (records) => {
      const response = await apiRequest("POST", "/api/master-data/bulk", { records });
      return await response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });

      const summary = result?.summary ?? {};
      const createdLines = Number(summary.createdLines ?? 0);
      const createdSubLines = Number(summary.createdSubLines ?? 0);
      const createdMachines = Number(summary.createdMachines ?? 0);

      toast({
        title: "Master data import complete",
        description: `Added ${createdLines} new lines, ${createdSubLines} sub lines, and ${createdMachines} machines.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to import master data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkProblemImportMutation = useMutation<any, Error, ProblemTypeImportRecord[]>({
    mutationFn: async (records) => {
      const response = await apiRequest("POST", "/api/problem-types/bulk", { records });
      return await response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/problem-types"] });
      const summary = result?.summary ?? {};
      const created = Number(summary.created ?? 0);
      const skipped = Number(summary.skipped ?? 0);
      toast({
        title: "Problem types import complete",
        description: `Added ${created} new problem types. Skipped ${skipped} existing.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to import problem types",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkEmployeeImportMutation = useMutation<any, Error, EmployeeImportRecord[]>({
    mutationFn: async (records) => {
      const response = await apiRequest("POST", "/api/employees/bulk", { records });
      return await response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      const summary = result?.summary ?? {};
      const created = Number(summary.created ?? 0);
      const skipped = Number(summary.skipped ?? 0);
      toast({
        title: "Employees import complete",
        description: `Added ${created} new employees. Skipped ${skipped} existing.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to import employees",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const rows = filteredMachines.map((machine: any) => {
      const lineId = resolveLineId(machine);
      const subLineId = resolveSubLineId(machine);
      const lineName = lines.find((line) => line.id === lineId)?.name ?? "";
      const subLineName = subLines.find((subLine) => subLine.id === subLineId)?.name ?? "";

      return {
        "Line Name": lineName,
        "Sub Line Name": subLineName,
        "Machine Code": resolveMachineCode(machine, machineCodeOverrides),
        "Machine Name": machine.name || "",
        "Maintenance Frequency": resolveMaintenanceFrequency(machine),
        "PM Plan Year": resolvePmPlanYear(machine),
        "Machine Uptime": resolveUptime(machine),
        "Machine Type": machine.type || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(
      rows.length > 0
        ? rows
        : [
            {
              "Line Name": "Assembly Line A",
              "Sub Line Name": "Station 1",
              "Machine Code": "MAC-001",
              "Machine Name": "Press Machine",
              "Maintenance Frequency": "Monthly",
              "PM Plan Year": "Jan-Jun",
              "Machine Uptime": "1290",
              "Machine Type": "Hydraulic",
            },
          ],
    );

    XLSX.utils.book_append_sheet(workbook, worksheet, "MasterData");
    XLSX.writeFile(workbook, "master_data_template.xlsx");
  };

  const handleEmployeeTemplateDownload = () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        "Employee Name": "Aditya Sharma",
        Role: "Technician",
        Department: "Maintenance",
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, "employees_template.xlsx");
  };

  const handleProblemTemplateDownload = () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        "Problem Type Name": "Oil Leak",
        Description: "Leakage from hydraulic system",
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "ProblemTypes");
    XLSX.writeFile(workbook, "problem_types_template.xlsx");
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      if (workbook.SheetNames.length === 0) {
        throw new Error("The uploaded workbook does not contain any sheets.");
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
        raw: false,
      });

      const records: BulkImportRecord[] = rows
        .map((row) => {
          const rawCode = String(row["Machine Code"] ?? "").trim();
          return {
            lineName: String(row["Line Name"] ?? "").trim(),
            subLineName: String(row["Sub Line Name"] ?? "").trim(),
            machineCode: rawCode ? rawCode.toUpperCase() : "",
            machineName: String(row["Machine Name"] ?? "").trim(),
            maintenanceFrequency: String(row["Maintenance Frequency"] ?? "").trim(),
            pmPlanYear: String(row["PM Plan Year"] ?? "").trim(),
            uptime: String(row["Machine Uptime"] ?? "").trim(),
            machineType: String(row["Machine Type"] ?? "").trim(),
          };
        })
        .filter((record) => record.lineName.length > 0);

      const invalidMachineRows = records.filter(
        (record) => record.machineName && !record.subLineName
      );

      if (invalidMachineRows.length > 0) {
        throw new Error(
          "Every machine row must include a Sub Line Name. Please update the file and try again."
        );
      }

      const missingMachineCodeRows = records.filter(
        (record) => record.machineName && !record.machineCode
      );

      if (missingMachineCodeRows.length > 0) {
        throw new Error(
          "Each machine row must include a Machine Code. Please update the file and try again."
        );
      }

      if (records.length === 0) {
        throw new Error("No valid rows were found. Ensure Line Name column is filled in.");
      }

      bulkImportMutation.mutate(records);
    } catch (error: any) {
      toast({
        title: "Invalid master data file",
        description: error?.message || "Unable to process the Excel file.",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleProblemFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      if (workbook.SheetNames.length === 0) {
        throw new Error("The uploaded workbook does not contain any sheets.");
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
        raw: false,
      });

      const records: ProblemTypeImportRecord[] = rows
        .map((row) => ({
          name: String(row["Problem Type Name"] ?? "").trim(),
          description: String(row["Description"] ?? "").trim(),
        }))
        .filter((record) => record.name.length > 0);

      if (records.length === 0) {
        throw new Error("No valid problem types found. Ensure the name column is filled in.");
      }

      bulkProblemImportMutation.mutate(records);
    } catch (error: any) {
      toast({
        title: "Invalid problem types file",
        description: error?.message || "Unable to process the Excel file.",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleEmployeeFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      if (workbook.SheetNames.length === 0) {
        throw new Error("The uploaded workbook does not contain any sheets.");
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
        raw: false,
      });

      const records: EmployeeImportRecord[] = rows
        .map((row) => ({
          name: String(row["Employee Name"] ?? "").trim(),
          role: String(row["Role"] ?? "").trim(),
          department: String(row["Department"] ?? "").trim(),
        }))
        .filter((record) => record.name.length > 0);

      if (records.length === 0) {
        throw new Error("No valid employees found. Ensure the name column is filled in.");
      }

      bulkEmployeeImportMutation.mutate(records);
    } catch (error: any) {
      toast({
        title: "Invalid employees file",
        description: error?.message || "Unable to process the Excel file.",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleProblemUploadClick = () => {
    problemFileInputRef.current?.click();
  };

  const handleEmployeeUploadClick = () => {
    employeeFileInputRef.current?.click();
  };

  const isBulkUploading = bulkImportMutation.isPending;
  const isBulkProblemUploading = bulkProblemImportMutation.isPending;
  const isBulkEmployeeUploading = bulkEmployeeImportMutation.isPending;
  const isSavingLine = addLineMutation.isPending || updateLineMutation.isPending;
  const isEditingLine = Boolean(editingLineId);
  const isDeletingLine = deleteLineMutation.isPending;
  const isSavingSubLine = addSubLineMutation.isPending || updateSubLineMutation.isPending;
  const isEditingSubLine = Boolean(editingSubLineId);
  const isDeletingSubLine = deleteSubLineMutation.isPending;

  const machineSubLineOptions = machineForm.lineId
    ? subLines.filter((subLine) => subLine.lineId === machineForm.lineId)
    : [];

  const isSavingMachine = addMachineMutation.isPending || updateMachineMutation.isPending;
  const isMachineBulkSaving = bulkUpdateMachinesMutation.isPending;
  const isDeletingMachine = deleteMachineMutation.isPending;
  const isBulkDeletingMachine = bulkDeleteMachinesMutation.isPending;
  const isEditingMachine = Boolean(editingMachineId);
  const isSavingEmployee = addEmployeeMutation.isPending || updateEmployeeMutation.isPending;
  const isDeletingEmployee = deleteEmployeeMutation.isPending;
  const isEditingEmployee = Boolean(editingEmployeeId);
  const isSavingProblem = addProblemMutation.isPending || updateProblemMutation.isPending;
  const isDeletingProblem = deleteProblemMutation.isPending;
  const isEditingProblem = Boolean(editingProblemId);
  const isSavingCapaCategory =
    addCapaCategoryMutation.isPending || updateCapaCategoryMutation.isPending;
  const isDeletingCapaCategory = deleteCapaCategoryMutation.isPending;
  const isEditingCapaCategory = Boolean(editingCapaCategoryId);

  const normalizedLineSearch = lineSearch.trim().toLowerCase();
  const normalizedSubLineSearch = subLineSearch.trim().toLowerCase();
  const normalizedMachineSearch = machineSearch.trim().toLowerCase();
  const normalizedMachinePmPlanYearFilter = machinePmPlanYearFilter.trim().toLowerCase();
  const normalizedMachineUptimeFilter = machineUptimeFilter.trim().toLowerCase();
  const normalizedEmployeeSearch = employeeSearch.trim().toLowerCase();
  const normalizedProblemSearch = problemSearch.trim().toLowerCase();
  const normalizedCapaCategorySearch = capaCategorySearch.trim().toLowerCase();

  const filteredLines = useMemo(() => {
    if (!normalizedLineSearch) return lines;
    return lines.filter((line) => {
      return (
        line.name?.toLowerCase().includes(normalizedLineSearch) ||
        (line.description ?? "").toLowerCase().includes(normalizedLineSearch)
      );
    });
  }, [lines, normalizedLineSearch]);

  const filteredSubLines = useMemo(() => {
    if (!normalizedSubLineSearch) return subLines;
    return subLines.filter((subLine) => {
      const parentLine = lines.find((line) => line.id === subLine.lineId);
      return (
        subLine.name?.toLowerCase().includes(normalizedSubLineSearch) ||
        (parentLine?.name ?? "").toLowerCase().includes(normalizedSubLineSearch)
      );
    });
  }, [lines, normalizedSubLineSearch, subLines]);

  const filteredMachines = useMemo(() => {
    return machines.filter((machine: any) => {
      const lineName = lines.find((line) => line.id === resolveLineId(machine))?.name ?? "";
      const subLineName = subLines.find((subLine) => subLine.id === resolveSubLineId(machine))?.name ?? "";
      const code = resolveMachineCode(machine);

      const maintenanceFrequency = resolveMaintenanceFrequency(machine);
      const pmPlanYear = resolvePmPlanYear(machine);
      const uptime = resolveUptime(machine);

      const matchesSearch =
        !normalizedMachineSearch ||
        String(machine.name ?? "").toLowerCase().includes(normalizedMachineSearch) ||
        String(code ?? "").toLowerCase().includes(normalizedMachineSearch) ||
        lineName.toLowerCase().includes(normalizedMachineSearch) ||
        subLineName.toLowerCase().includes(normalizedMachineSearch);

      const matchesFrequency =
        machineFrequencyFilter === "all" ||
        maintenanceFrequency.toLowerCase() === machineFrequencyFilter.toLowerCase();

      const matchesPmPlanYear =
        !normalizedMachinePmPlanYearFilter ||
        pmPlanYear.toLowerCase().includes(normalizedMachinePmPlanYearFilter);

      const matchesUptime =
        !normalizedMachineUptimeFilter ||
        uptime.toLowerCase().includes(normalizedMachineUptimeFilter);

      return matchesSearch && matchesFrequency && matchesPmPlanYear && matchesUptime;
    });
  }, [
    lines,
    machineFrequencyFilter,
    machines,
    normalizedMachinePmPlanYearFilter,
    normalizedMachineSearch,
    normalizedMachineUptimeFilter,
    subLines,
  ]);

  const filteredEmployees = useMemo(() => {
    if (!normalizedEmployeeSearch) return employees;
    return employees.filter((employee) => {
      return (
        String(employee.name ?? "").toLowerCase().includes(normalizedEmployeeSearch) ||
        String(employee.role ?? "").toLowerCase().includes(normalizedEmployeeSearch) ||
        String(employee.department ?? "").toLowerCase().includes(normalizedEmployeeSearch)
      );
    });
  }, [employees, normalizedEmployeeSearch]);

  const filteredProblemTypes = useMemo(() => {
    if (!normalizedProblemSearch) return problemTypes;
    return problemTypes.filter((problemType) => {
      return (
        String(problemType.name ?? "").toLowerCase().includes(normalizedProblemSearch) ||
        String(problemType.description ?? "").toLowerCase().includes(normalizedProblemSearch)
      );
    });
  }, [normalizedProblemSearch, problemTypes]);

  const filteredCapaCategories = useMemo(() => {
    if (!normalizedCapaCategorySearch) return capaCategories;
    return capaCategories.filter((category) =>
      String(category.name ?? "").toLowerCase().includes(normalizedCapaCategorySearch),
    );
  }, [capaCategories, normalizedCapaCategorySearch]);

  useEffect(() => setLinePage(1), [normalizedLineSearch]);
  useEffect(() => setSubLinePage(1), [normalizedSubLineSearch]);
  useEffect(() => setMachinePage(1), [
    machineFrequencyFilter,
    normalizedMachinePmPlanYearFilter,
    normalizedMachineSearch,
    normalizedMachineUptimeFilter,
  ]);
  useEffect(() => setEmployeePage(1), [normalizedEmployeeSearch]);
  useEffect(() => setProblemPage(1), [normalizedProblemSearch]);
  useEffect(() => setCapaCategoryPage(1), [normalizedCapaCategorySearch]);

  const lineTotalPages = Math.max(1, Math.ceil(filteredLines.length / PAGE_SIZE));
  const subLineTotalPages = Math.max(1, Math.ceil(filteredSubLines.length / PAGE_SIZE));
  const machineTotalPages = Math.max(1, Math.ceil(filteredMachines.length / PAGE_SIZE));
  const employeeTotalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const problemTotalPages = Math.max(1, Math.ceil(filteredProblemTypes.length / PAGE_SIZE));
  const capaCategoryTotalPages = Math.max(1, Math.ceil(filteredCapaCategories.length / PAGE_SIZE));

  const pagedLines = filteredLines.slice((linePage - 1) * PAGE_SIZE, linePage * PAGE_SIZE);
  const pagedSubLines = filteredSubLines.slice((subLinePage - 1) * PAGE_SIZE, subLinePage * PAGE_SIZE);
  const pagedMachines = filteredMachines.slice((machinePage - 1) * PAGE_SIZE, machinePage * PAGE_SIZE);
  const pagedEmployees = filteredEmployees.slice((employeePage - 1) * PAGE_SIZE, employeePage * PAGE_SIZE);
  const pagedProblemTypes = filteredProblemTypes.slice((problemPage - 1) * PAGE_SIZE, problemPage * PAGE_SIZE);
  const pagedCapaCategories = filteredCapaCategories.slice(
    (capaCategoryPage - 1) * PAGE_SIZE,
    capaCategoryPage * PAGE_SIZE,
  );
  const machineTableColSpan = isAdmin && isMachineBulkEditMode ? 10 : 9;
  const allMachineRowsSelectedOnPage =
    pagedMachines.length > 0 &&
    pagedMachines.every((machine: any) => selectedMachineIds.includes(machine.id));

  useEffect(() => {
    if (!isMachineBulkEditMode) {
      return;
    }
    setBulkMachineDrafts((prev) => {
      const next = { ...prev };
      for (const machine of pagedMachines as any[]) {
        if (!next[machine.id]) {
          next[machine.id] = {
            name: String(machine.name ?? ""),
            code: resolveMachineCode(machine, machineCodeOverrides).toUpperCase(),
            type: String(machine.type ?? ""),
            maintenanceFrequency: resolveMaintenanceFrequency(machine),
            pmPlanYear: resolvePmPlanYear(machine),
            uptime: resolveUptime(machine),
          };
        }
      }
      return next;
    });
  }, [isMachineBulkEditMode, machineCodeOverrides, pagedMachines]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Master Data Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage lines, machines, employees, problem types, and CAPA categories</p>
      </div>

      {isAdmin && activeTab === "machines" && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Bulk Import</h2>
              <p className="text-sm text-muted-foreground">
                Download the template, fill in lines, sub lines, and machines, then upload the completed Excel file.
                Existing records are reused automatically.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                data-testid="button-download-master-template"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <Button
                onClick={handleUploadClick}
                disabled={isBulkUploading}
                data-testid="button-upload-master"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isBulkUploading ? "Uploading..." : "Upload Excel"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Required columns: Line Name, Sub Line Name (when adding machines), Machine Code, Machine Name, Maintenance Frequency (optional), PM Plan Year (optional), Machine Uptime (optional), Machine Type (optional).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="lines" data-testid="tab-lines">Lines</TabsTrigger>
          <TabsTrigger value="sublines" data-testid="tab-sublines">Sub Lines</TabsTrigger>
          <TabsTrigger value="machines" data-testid="tab-machines">Machines</TabsTrigger>
          <TabsTrigger value="employees" data-testid="tab-employees">Employees</TabsTrigger>
          <TabsTrigger value="problems" data-testid="tab-problems">Problem Types</TabsTrigger>
          <TabsTrigger value="capa-categories" data-testid="tab-capa-categories">CAPA Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="space-y-4">
          <Card className="p-4">
            <div className="space-y-2">
              <Label htmlFor="line-search">Filter</Label>
              <Input
                id="line-search"
                value={lineSearch}
                onChange={(event) => setLineSearch(event.target.value)}
                placeholder="Search lines by name or description"
              />
            </div>
          </Card>
          <div className="flex justify-end">
            {isAdmin && (
              <Button
                onClick={handleStartCreateLine}
                data-testid="button-add-line"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Line
              </Button>
            )}
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Description</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linesLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filteredLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No lines found</TableCell>
                  </TableRow>
                ) : (
                  pagedLines.map((line) => (
                    <TableRow key={line.id} data-testid={`row-line-${line.id}`}>
                      <TableCell className="font-medium">{line.name}</TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditLine(line)}
                              disabled={isSavingLine || isDeletingLine}
                              data-testid={`button-edit-line-${line.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteLine(line)}
                              disabled={isDeletingLine}
                              data-testid={`button-delete-line-${line.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {filteredLines.length > 0
                ? `Showing ${(linePage - 1) * PAGE_SIZE + 1}-${Math.min(linePage * PAGE_SIZE, filteredLines.length)} of ${filteredLines.length}`
                : "No lines match your filter."}
            </div>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setLinePage((prev) => Math.max(1, prev - 1));
                    }}
                    aria-disabled={linePage === 1}
                    className={linePage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm text-muted-foreground px-4 py-2">
                    Page {linePage} of {lineTotalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setLinePage((prev) => Math.min(lineTotalPages, prev + 1));
                    }}
                    aria-disabled={linePage === lineTotalPages}
                    className={linePage === lineTotalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
          {isAdmin && (
            <Dialog open={isAddLineDialogOpen} onOpenChange={handleLineDialogChange}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEditingLine ? "Edit Line" : "Add Line"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddLineSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="line-name">Line Name</Label>
                    <Input
                      id="line-name"
                      value={lineForm.name}
                      onChange={(event) =>
                        setLineForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="Enter line name"
                      required
                      data-testid="input-line-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="line-description">Description</Label>
                    <Input
                      id="line-description"
                      value={lineForm.description}
                      onChange={(event) =>
                        setLineForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Describe the line (optional)"
                      data-testid="input-line-description"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleLineDialogChange(false)}
                      data-testid="button-cancel-add-line"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSavingLine}
                      data-testid="button-submit-add-line"
                    >
                      {isSavingLine ? "Saving..." : isEditingLine ? "Save Changes" : "Save Line"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="sublines" className="space-y-4">
          <Card className="p-4">
            <div className="space-y-2">
              <Label htmlFor="subline-search">Filter</Label>
              <Input
                id="subline-search"
                value={subLineSearch}
                onChange={(event) => setSubLineSearch(event.target.value)}
                placeholder="Search sub lines by name or line"
              />
            </div>
          </Card>
          <div className="flex justify-end">
            {isAdmin && (
              <Button
                onClick={handleStartCreateSubLine}
                data-testid="button-add-subline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Sub Line
              </Button>
            )}
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Line</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subLinesLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filteredSubLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No sub lines found</TableCell>
                  </TableRow>
                ) : (
                  pagedSubLines.map((subLine) => {
                    const parentLine = lines.find((line) => line.id === subLine.lineId);
                    return (
                      <TableRow key={subLine.id} data-testid={`row-subline-${subLine.id}`}>
                        <TableCell className="font-medium">{subLine.name}</TableCell>
                        <TableCell>{parentLine?.name || '-'}</TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditSubLine(subLine)}
                                disabled={isSavingSubLine || isDeletingSubLine}
                                data-testid={`button-edit-subline-${subLine.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteSubLine(subLine)}
                                disabled={isDeletingSubLine}
                                data-testid={`button-delete-subline-${subLine.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {filteredSubLines.length > 0
                ? `Showing ${(subLinePage - 1) * PAGE_SIZE + 1}-${Math.min(subLinePage * PAGE_SIZE, filteredSubLines.length)} of ${filteredSubLines.length}`
                : "No sub lines match your filter."}
            </div>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setSubLinePage((prev) => Math.max(1, prev - 1));
                    }}
                    aria-disabled={subLinePage === 1}
                    className={subLinePage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm text-muted-foreground px-4 py-2">
                    Page {subLinePage} of {subLineTotalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setSubLinePage((prev) => Math.min(subLineTotalPages, prev + 1));
                    }}
                    aria-disabled={subLinePage === subLineTotalPages}
                    className={subLinePage === subLineTotalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
          {isAdmin && (
            <Dialog open={isAddSubLineDialogOpen} onOpenChange={handleSubLineDialogChange}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEditingSubLine ? "Edit Sub Line" : "Add Sub Line"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddSubLineSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subline-line">Parent Line</Label>
                    <Select
                      value={subLineForm.lineId}
                      onValueChange={(value) => setSubLineForm((prev) => ({ ...prev, lineId: value }))}
                      disabled={lines.length === 0}
                    >
                      <SelectTrigger id="subline-line" data-testid="select-subline-line">
                        <SelectValue placeholder={lines.length === 0 ? "No lines available" : "Select line"} />
                      </SelectTrigger>
                      <SelectContent>
                        {lines.map((line) => (
                          <SelectItem key={line.id} value={line.id}>
                            {line.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subline-name">Sub Line Name</Label>
                    <Input
                      id="subline-name"
                      value={subLineForm.name}
                      onChange={(event) =>
                        setSubLineForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="Enter sub line name"
                      required
                      data-testid="input-subline-name"
                    />
                  </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleSubLineDialogChange(false)}
                        data-testid="button-cancel-add-subline"
                    >
                      Cancel
                    </Button>
                      <Button
                        type="submit"
                        disabled={isSavingSubLine || !subLineForm.lineId}
                        data-testid="button-submit-add-subline"
                      >
                        {isSavingSubLine
                          ? "Saving..."
                          : isEditingSubLine
                            ? "Save Changes"
                            : "Save Sub Line"}
                      </Button>
                    </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="machines" className="space-y-4">
          <Card className="p-4">
            <div className="space-y-2">
              <Label htmlFor="machine-search">Filter</Label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input
                  id="machine-search"
                  value={machineSearch}
                  onChange={(event) => setMachineSearch(event.target.value)}
                  placeholder="Search machines by name, code, line, or sub line"
                />
                <Select value={machineFrequencyFilter} onValueChange={setMachineFrequencyFilter}>
                  <SelectTrigger data-testid="select-machine-frequency-filter">
                    <SelectValue placeholder="Maintenance Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Frequencies</SelectItem>
                    {MAINTENANCE_FREQUENCIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={machinePmPlanYearFilter}
                  onChange={(event) => setMachinePmPlanYearFilter(event.target.value)}
                  placeholder="Filter by PM Plan Year"
                  data-testid="input-machine-pm-plan-year-filter"
                />
                <Input
                  value={machineUptimeFilter}
                  onChange={(event) => setMachineUptimeFilter(event.target.value)}
                  placeholder="Filter by Uptime"
                  data-testid="input-machine-uptime-filter"
                />
              </div>
            </div>
            {isAdmin ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={isMachineBulkEditMode ? "secondary" : "outline"}
                  onClick={handleToggleMachineBulkMode}
                  disabled={isSavingMachine || isMachineBulkSaving || isBulkDeletingMachine}
                >
                  {isMachineBulkEditMode ? "Exit Bulk Inline Edit" : "Bulk Inline Edit"}
                </Button>
                {isMachineBulkEditMode ? (
                  <>
                    <Button
                      type="button"
                      onClick={handleSaveBulkMachineEdits}
                      disabled={isMachineBulkSaving || isBulkDeletingMachine || selectedMachineIds.length === 0}
                    >
                      {isMachineBulkSaving ? "Saving..." : `Save Selected (${selectedMachineIds.length})`}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleBulkDeleteMachines}
                      disabled={
                        isMachineBulkSaving ||
                        isBulkDeletingMachine ||
                        machineBreakdownUsageLoading ||
                        selectedMachineIds.length === 0
                      }
                    >
                      {isBulkDeletingMachine ? "Deleting..." : `Delete Selected (${selectedMachineIds.length})`}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCancelMachineBulkMode}
                      disabled={isMachineBulkSaving || isBulkDeletingMachine}
                    >
                      Cancel
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
          </Card>
          <div className="flex justify-end">
            {isAdmin && (
              <Button
                onClick={() => handleMachineDialogChange(true)}
                data-testid="button-add-machine"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Machine
              </Button>
            )}
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && isMachineBulkEditMode ? (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={allMachineRowsSelectedOnPage}
                        onChange={(event) => handleSelectAllMachinesOnPage(event.target.checked)}
                        aria-label="Select all machines on this page"
                      />
                    </TableHead>
                  ) : null}
                  <TableHead className="text-xs font-semibold uppercase">Line</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Sub Line</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Code</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Maintenance Frequency</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">PM Plan Year</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Uptime (min)</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {machinesLoading ? (
                  <TableRow>
                    <TableCell colSpan={machineTableColSpan} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filteredMachines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={machineTableColSpan} className="text-center text-muted-foreground">No machines found</TableCell>
                  </TableRow>
                ) : (
                  pagedMachines.map((machine) => {
                    const lineId = resolveLineId(machine);
                    const subLineId = resolveSubLineId(machine);
                    const line = lines.find((l) => l.id === lineId);
                    const subLine = subLines.find((sl) => sl.id === subLineId);
                    const machineCode = resolveMachineCode(machine, machineCodeOverrides);
                    const maintenanceFrequency = resolveMaintenanceFrequency(machine);
                    const pmPlanYear = resolvePmPlanYear(machine);
                    const uptime = resolveUptime(machine);
                    const linkedBreakdowns = machineBreakdownUsage[machine.id] ?? [];
                    const hasLinkedBreakdowns = linkedBreakdowns.length > 0;
                    const draft = bulkMachineDrafts[machine.id] ?? {
                      name: machine.name || "",
                      code: machineCode || "",
                      type: machine.type || "",
                      maintenanceFrequency: maintenanceFrequency || "",
                      pmPlanYear: pmPlanYear || "",
                      uptime: uptime || "",
                    };
                    const isSelectedForBulkEdit = selectedMachineIds.includes(machine.id);
                    return (
                      <TableRow key={machine.id} data-testid={`row-machine-${machine.id}`}>
                        {isAdmin && isMachineBulkEditMode ? (
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelectedForBulkEdit}
                              onChange={(event) =>
                                handleToggleMachineSelection(machine.id, event.target.checked)
                              }
                              aria-label={`Select machine ${machine.name}`}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell>{line?.name || '-'}</TableCell>
                        <TableCell>{subLine?.name || '-'}</TableCell>
                        <TableCell className="font-mono">
                          {isAdmin && isMachineBulkEditMode && isSelectedForBulkEdit ? (
                            <Input
                              value={draft.code}
                              onChange={(event) =>
                                handleBulkMachineFieldChange(machine.id, "code", event.target.value.toUpperCase())
                              }
                              className="h-8"
                            />
                          ) : (
                            machineCode || "-"
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {isAdmin && isMachineBulkEditMode && isSelectedForBulkEdit ? (
                            <Input
                              value={draft.name}
                              onChange={(event) =>
                                handleBulkMachineFieldChange(machine.id, "name", event.target.value)
                              }
                              className="h-8"
                            />
                          ) : (
                            machine.name
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdmin && isMachineBulkEditMode && isSelectedForBulkEdit ? (
                            <Input
                              value={draft.type}
                              onChange={(event) =>
                                handleBulkMachineFieldChange(machine.id, "type", event.target.value)
                              }
                              className="h-8"
                            />
                          ) : (
                            machine.type || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdmin && isMachineBulkEditMode && isSelectedForBulkEdit ? (
                            <Select
                              value={draft.maintenanceFrequency || "none"}
                              onValueChange={(value) =>
                                handleBulkMachineFieldChange(
                                  machine.id,
                                  "maintenanceFrequency",
                                  value === "none" ? "" : value,
                                )
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {MAINTENANCE_FREQUENCIES.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            maintenanceFrequency || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdmin && isMachineBulkEditMode && isSelectedForBulkEdit ? (
                            <Input
                              value={draft.pmPlanYear}
                              onChange={(event) =>
                                handleBulkMachineFieldChange(machine.id, "pmPlanYear", event.target.value)
                              }
                              className="h-8"
                            />
                          ) : (
                            pmPlanYear || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdmin && isMachineBulkEditMode && isSelectedForBulkEdit ? (
                            <Input
                              type="number"
                              min="0"
                              value={draft.uptime}
                              onChange={(event) =>
                                handleBulkMachineFieldChange(machine.id, "uptime", event.target.value)
                              }
                              className="h-8"
                            />
                          ) : (
                            uptime || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditMachine(machine)}
                                disabled={isSavingMachine || isDeletingMachine || isMachineBulkEditMode}
                                data-testid={`button-edit-machine-${machine.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteMachine(machine)}
                                disabled={
                                  isDeletingMachine ||
                                  isMachineBulkEditMode ||
                                  machineBreakdownUsageLoading
                                }
                                aria-disabled={hasLinkedBreakdowns}
                                title={
                                  machineBreakdownUsageLoading
                                    ? "Checking breakdown usage"
                                    : hasLinkedBreakdowns
                                      ? "Delete disabled: machine has associated breakdown entries"
                                      : "Delete machine"
                                }
                                className={hasLinkedBreakdowns ? "cursor-not-allowed opacity-50" : undefined}
                                data-testid={`button-delete-machine-${machine.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {filteredMachines.length > 0
                ? `Showing ${(machinePage - 1) * PAGE_SIZE + 1}-${Math.min(machinePage * PAGE_SIZE, filteredMachines.length)} of ${filteredMachines.length}`
                : "No machines match your filter."}
            </div>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setMachinePage((prev) => Math.max(1, prev - 1));
                    }}
                    aria-disabled={machinePage === 1}
                    className={machinePage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm text-muted-foreground px-4 py-2">
                    Page {machinePage} of {machineTotalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setMachinePage((prev) => Math.min(machineTotalPages, prev + 1));
                    }}
                    aria-disabled={machinePage === machineTotalPages}
                    className={machinePage === machineTotalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
          {isAdmin && (
            <Dialog open={isAddMachineDialogOpen} onOpenChange={handleMachineDialogChange}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEditingMachine ? "Edit Machine" : "Add Machine"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddMachineSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="machine-line">Line</Label>
                    <Select
                      value={machineForm.lineId}
                      onValueChange={(value) =>
                        setMachineForm((prev) => ({ ...prev, lineId: value, subLineId: "" }))
                      }
                      disabled={lines.length === 0}
                    >
                      <SelectTrigger id="machine-line" data-testid="select-machine-line">
                        <SelectValue placeholder={lines.length === 0 ? "No lines available" : "Select line"} />
                      </SelectTrigger>
                      <SelectContent>
                        {lines.map((line) => (
                          <SelectItem key={line.id} value={line.id}>
                            {line.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machine-subline">Sub Line</Label>
                    <Select
                      value={machineForm.subLineId}
                      onValueChange={(value) => setMachineForm((prev) => ({ ...prev, subLineId: value }))}
                      disabled={!machineForm.lineId || machineSubLineOptions.length === 0}
                    >
                      <SelectTrigger id="machine-subline" data-testid="select-machine-subline">
                        <SelectValue
                          placeholder={
                            !machineForm.lineId
                              ? "Select line first"
                              : machineSubLineOptions.length === 0
                                ? "No sub lines available"
                                : "Select sub line"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {machineSubLineOptions.map((subLine) => (
                          <SelectItem key={subLine.id} value={subLine.id}>
                            {subLine.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machine-name">Machine Name</Label>
                    <Input
                      id="machine-name"
                      value={machineForm.name}
                      onChange={(event) =>
                        setMachineForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="Enter machine name"
                      required
                      data-testid="input-machine-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machine-code">Machine Code</Label>
                    <Input
                      id="machine-code"
                      value={machineForm.code}
                      onChange={(event) =>
                        setMachineForm((prev) => ({
                          ...prev,
                          code: event.target.value.toUpperCase().trim(),
                        }))
                      }
                      placeholder="Enter machine code"
                      required
                      data-testid="input-machine-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machine-type">Machine Type</Label>
                    <Input
                      id="machine-type"
                      value={machineForm.type}
                      onChange={(event) =>
                        setMachineForm((prev) => ({ ...prev, type: event.target.value }))
                      }
                      placeholder="Enter machine type (optional)"
                      data-testid="input-machine-type"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machine-frequency">Maintenance Frequency</Label>
                    <Select
                      value={machineForm.maintenanceFrequency || "none"}
                      onValueChange={(value) =>
                        setMachineForm((prev) => ({
                          ...prev,
                          maintenanceFrequency: value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id="machine-frequency" data-testid="select-machine-frequency">
                        <SelectValue placeholder="Select frequency (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_FREQUENCIES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                        <SelectItem value="none">Not Specified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machine-plan-year">PM Plan Year</Label>
                    <Input
                      id="machine-plan-year"
                      value={machineForm.pmPlanYear}
                      onChange={(event) =>
                        setMachineForm((prev) => ({ ...prev, pmPlanYear: event.target.value.trim() }))
                      }
                      placeholder="Enter PM plan window (optional)"
                      data-testid="input-machine-plan-year"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machine-uptime">Machine Uptime (minutes)</Label>
                    <Input
                      id="machine-uptime"
                      value={machineForm.uptime}
                      onChange={(event) =>
                        setMachineForm((prev) => ({ ...prev, uptime: event.target.value.replace(/[^0-9]/g, "") }))
                      }
                      inputMode="numeric"
                      placeholder="Enter uptime in minutes (optional)"
                      data-testid="input-machine-uptime"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleMachineDialogChange(false)}
                      data-testid="button-cancel-add-machine"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        isSavingMachine ||
                        !machineForm.lineId ||
                        !machineForm.subLineId ||
                        !machineForm.name ||
                        !machineForm.code
                      }
                      data-testid="button-submit-add-machine"
                    >
                      {isSavingMachine ? "Saving..." : isEditingMachine ? "Save Changes" : "Save Machine"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={!!machineDeleteBlock} onOpenChange={(open) => !open && setMachineDeleteBlock(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Machine cannot be deleted</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {machineDeleteBlock?.machine ? (
                    <>
                      The machine{" "}
                      <span className="font-medium text-foreground">
                        {machineDeleteBlock.machine.name ||
                          resolveMachineCode(machineDeleteBlock.machine, machineCodeOverrides) ||
                          "-"}
                      </span>{" "}
                      has associated breakdown entries.
                    </>
                  ) : (
                    <>One or more selected machines have associated breakdown entries.</>
                  )}{" "}
                  Delete is disabled until those entries are removed or moved to another machine.
                </p>
                <div className="max-h-[420px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold uppercase">Machine</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Shift</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-right">Downtime</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Problem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(machineDeleteBlock?.breakdowns ?? []).map((breakdown) => (
                        <TableRow key={breakdown.id}>
                          <TableCell>{breakdown.machineName || "-"}</TableCell>
                          <TableCell className="font-mono">{formatBreakdownDate(breakdown.date)}</TableCell>
                          <TableCell>{breakdown.shift || "-"}</TableCell>
                          <TableCell className="capitalize">{breakdown.status || "-"}</TableCell>
                          <TableCell className="text-right font-mono">
                            {breakdown.totalMinutes ?? "-"}
                          </TableCell>
                          <TableCell>{breakdown.problemDescription || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setMachineDeleteBlock(null)}>
                  OK
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          {isAdmin && (
            <Card className="p-4 space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Bulk Import - Employees</h2>
                  <p className="text-sm text-muted-foreground">
                    Download the template, fill in employees, then upload the completed Excel file.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleEmployeeTemplateDownload}
                    data-testid="button-download-employee-template"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                  <Button
                    onClick={handleEmployeeUploadClick}
                    disabled={isBulkEmployeeUploading}
                    data-testid="button-upload-employee-excel"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isBulkEmployeeUploading ? "Uploading..." : "Upload Excel"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Required columns: Employee Name. Role and Department are optional.
              </p>
              <input
                ref={employeeFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleEmployeeFileChange}
              />
            </Card>
          )}
          <Card className="p-4">
            <div className="space-y-2">
              <Label htmlFor="employee-search">Filter</Label>
              <Input
                id="employee-search"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                placeholder="Search employees by name, role, or department"
              />
            </div>
          </Card>
          <div className="flex justify-end">
            {isAdmin && (
              <Button onClick={handleStartCreateEmployee} data-testid="button-add-employee">
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            )}
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Role</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Department</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeesLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No employees found</TableCell>
                  </TableRow>
                ) : (
                  pagedEmployees.map((employee) => (
                    <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.role || '-'}</TableCell>
                      <TableCell>{employee.department || '-'}</TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditEmployee(employee)}
                              disabled={isSavingEmployee || isDeletingEmployee}
                              data-testid={`button-edit-employee-${employee.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteEmployee(employee)}
                              disabled={isDeletingEmployee}
                              data-testid={`button-delete-employee-${employee.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {filteredEmployees.length > 0
                ? `Showing ${(employeePage - 1) * PAGE_SIZE + 1}-${Math.min(employeePage * PAGE_SIZE, filteredEmployees.length)} of ${filteredEmployees.length}`
                : "No employees match your filter."}
            </div>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setEmployeePage((prev) => Math.max(1, prev - 1));
                    }}
                    aria-disabled={employeePage === 1}
                    className={employeePage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm text-muted-foreground px-4 py-2">
                    Page {employeePage} of {employeeTotalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setEmployeePage((prev) => Math.min(employeeTotalPages, prev + 1));
                    }}
                    aria-disabled={employeePage === employeeTotalPages}
                    className={employeePage === employeeTotalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
          {isAdmin && (
            <Dialog open={isAddEmployeeDialogOpen} onOpenChange={handleEmployeeDialogChange}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEditingEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddEmployeeSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee-name">Employee Name</Label>
                    <Input
                      id="employee-name"
                      value={employeeForm.name}
                      onChange={(event) =>
                        setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      required
                      placeholder="Enter employee name"
                      data-testid="input-employee-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-role">Role</Label>
                    <Input
                      id="employee-role"
                      value={employeeForm.role}
                      onChange={(event) =>
                        setEmployeeForm((prev) => ({ ...prev, role: event.target.value }))
                      }
                      placeholder="Enter role"
                      data-testid="input-employee-role"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-department">Department</Label>
                    <Input
                      id="employee-department"
                      value={employeeForm.department}
                      onChange={(event) =>
                        setEmployeeForm((prev) => ({ ...prev, department: event.target.value }))
                      }
                      placeholder="Enter department"
                      data-testid="input-employee-department"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleEmployeeDialogChange(false)}
                      data-testid="button-cancel-add-employee"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSavingEmployee || !employeeForm.name}
                      data-testid="button-submit-add-employee"
                    >
                      {isSavingEmployee
                        ? "Saving..."
                        : isEditingEmployee
                          ? "Save Changes"
                          : "Save Employee"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="problems" className="space-y-4">
          {isAdmin && (
            <Card className="p-4 space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Bulk Import - Problem Types</h2>
                  <p className="text-sm text-muted-foreground">
                    Download the template, fill in problem types, then upload the completed Excel file.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleProblemTemplateDownload}
                    data-testid="button-download-problem-template"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                  <Button
                    onClick={handleProblemUploadClick}
                    disabled={isBulkProblemUploading}
                    data-testid="button-upload-problem-excel"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isBulkProblemUploading ? "Uploading..." : "Upload Excel"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Required columns: Problem Type Name. Description is optional.
              </p>
              <input
                ref={problemFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleProblemFileChange}
              />
            </Card>
          )}
          <Card className="p-4">
            <div className="space-y-2">
              <Label htmlFor="problem-search">Filter</Label>
              <Input
                id="problem-search"
                value={problemSearch}
                onChange={(event) => setProblemSearch(event.target.value)}
                placeholder="Search problem types by name or description"
              />
            </div>
          </Card>
          <div className="flex justify-end">
            {isAdmin && (
              <Button onClick={handleStartCreateProblem} data-testid="button-add-problem">
                <Plus className="h-4 w-4 mr-2" />
                Add Problem Type
              </Button>
            )}
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Description</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problemTypesLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filteredProblemTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No problem types found</TableCell>
                  </TableRow>
                ) : (
                  pagedProblemTypes.map((problemType) => (
                    <TableRow key={problemType.id} data-testid={`row-problem-${problemType.id}`}>
                      <TableCell className="font-medium">{problemType.name}</TableCell>
                      <TableCell>{problemType.description || '-'}</TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditProblem(problemType)}
                              disabled={isSavingProblem || isDeletingProblem}
                              data-testid={`button-edit-problem-${problemType.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteProblem(problemType)}
                              disabled={isDeletingProblem}
                              data-testid={`button-delete-problem-${problemType.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {filteredProblemTypes.length > 0
                ? `Showing ${(problemPage - 1) * PAGE_SIZE + 1}-${Math.min(problemPage * PAGE_SIZE, filteredProblemTypes.length)} of ${filteredProblemTypes.length}`
                : "No problem types match your filter."}
            </div>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setProblemPage((prev) => Math.max(1, prev - 1));
                    }}
                    aria-disabled={problemPage === 1}
                    className={problemPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm text-muted-foreground px-4 py-2">
                    Page {problemPage} of {problemTotalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setProblemPage((prev) => Math.min(problemTotalPages, prev + 1));
                    }}
                    aria-disabled={problemPage === problemTotalPages}
                    className={problemPage === problemTotalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
          {isAdmin && (
            <Dialog open={isAddProblemDialogOpen} onOpenChange={handleProblemDialogChange}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEditingProblem ? "Edit Problem Type" : "Add Problem Type"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddProblemSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="problem-name">Problem Type Name</Label>
                    <Input
                      id="problem-name"
                      value={problemForm.name}
                      onChange={(event) =>
                        setProblemForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      required
                      placeholder="Enter problem type name"
                      data-testid="input-problem-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="problem-description">Description</Label>
                    <Input
                      id="problem-description"
                      value={problemForm.description}
                      onChange={(event) =>
                        setProblemForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Enter description (optional)"
                      data-testid="input-problem-description"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleProblemDialogChange(false)}
                      data-testid="button-cancel-add-problem"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSavingProblem || !problemForm.name}
                      data-testid="button-submit-add-problem"
                    >
                      {isSavingProblem
                        ? "Saving..."
                        : isEditingProblem
                          ? "Save Changes"
                          : "Save Problem"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="capa-categories" className="space-y-4">
          <Card className="p-4">
            <div className="space-y-2">
              <Label htmlFor="capa-category-search">Filter</Label>
              <Input
                id="capa-category-search"
                value={capaCategorySearch}
                onChange={(event) => setCapaCategorySearch(event.target.value)}
                placeholder="Search CAPA categories by name"
              />
            </div>
          </Card>

          <div className="flex justify-end">
            {isAdmin && (
              <Button onClick={handleStartCreateCapaCategory} data-testid="button-add-capa-category">
                <Plus className="h-4 w-4 mr-2" />
                Add CAPA Category
              </Button>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {capaCategoriesLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filteredCapaCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">No CAPA categories found</TableCell>
                  </TableRow>
                ) : (
                  pagedCapaCategories.map((category) => (
                    <TableRow key={category.id} data-testid={`row-capa-category-${category.id}`}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditCapaCategory(category)}
                              disabled={isSavingCapaCategory || isDeletingCapaCategory}
                              data-testid={`button-edit-capa-category-${category.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteCapaCategory(category)}
                              disabled={isDeletingCapaCategory}
                              data-testid={`button-delete-capa-category-${category.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {filteredCapaCategories.length > 0
                ? `Showing ${(capaCategoryPage - 1) * PAGE_SIZE + 1}-${Math.min(capaCategoryPage * PAGE_SIZE, filteredCapaCategories.length)} of ${filteredCapaCategories.length}`
                : "No CAPA categories match your filter."}
            </div>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setCapaCategoryPage((prev) => Math.max(1, prev - 1));
                    }}
                    aria-disabled={capaCategoryPage === 1}
                    className={capaCategoryPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm text-muted-foreground px-4 py-2">
                    Page {capaCategoryPage} of {capaCategoryTotalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setCapaCategoryPage((prev) => Math.min(capaCategoryTotalPages, prev + 1));
                    }}
                    aria-disabled={capaCategoryPage === capaCategoryTotalPages}
                    className={capaCategoryPage === capaCategoryTotalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>

          {isAdmin && (
            <Dialog open={isAddCapaCategoryDialogOpen} onOpenChange={handleCapaCategoryDialogChange}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEditingCapaCategory ? "Edit CAPA Category" : "Add CAPA Category"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddCapaCategorySubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="capa-category-name">CAPA Category Name</Label>
                    <Input
                      id="capa-category-name"
                      value={capaCategoryForm.name}
                      onChange={(event) =>
                        setCapaCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      required
                      placeholder="Enter CAPA category name"
                      data-testid="input-capa-category-name"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleCapaCategoryDialogChange(false)}
                      data-testid="button-cancel-add-capa-category"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSavingCapaCategory || !capaCategoryForm.name.trim()}
                      data-testid="button-submit-add-capa-category"
                    >
                      {isSavingCapaCategory
                        ? "Saving..."
                        : isEditingCapaCategory
                          ? "Save Changes"
                          : "Save CAPA Category"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
