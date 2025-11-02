import { ChangeEvent, FormEvent, useCallback, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Upload, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  lineDescription?: string;
  subLineName?: string;
  machineName?: string;
  machineCode?: string;
  machineType?: string;
  maintenanceFrequency?: string;
  pmPlanYear?: string;
  uptime?: string;
};

const MACHINE_CODE_STORAGE_KEY = "master-data-machine-codes";
const MAINTENANCE_FREQUENCIES = ["Monthly", "Quarterly", "Half Yearly", "Yearly"];

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

const resolveUptime = (machine: any): string => {
  const candidates = [machine?.uptime, machine?.machineUptime, machine?.machine_uptime];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
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
  const [activeTab, setActiveTab] = useState("lines");
  const [isAddLineDialogOpen, setIsAddLineDialogOpen] = useState(false);
  const [isAddSubLineDialogOpen, setIsAddSubLineDialogOpen] = useState(false);
  const [isAddMachineDialogOpen, setIsAddMachineDialogOpen] = useState(false);
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
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  const { data: lines = [], isLoading: linesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/lines"] 
  });

  const { data: subLines = [], isLoading: subLinesLoading } = useQuery<any[]>({
    queryKey: ["/api/sub-lines"],
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/machines"] 
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/employees"] 
  });

  const { data: problemTypes = [], isLoading: problemTypesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/problem-types"] 
  });

  const addLineMutation = useMutation({
    mutationFn: async (data: typeof lineForm) => {
      await apiRequest("POST", "/api/lines", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      setLineForm({ name: "", description: "" });
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

  const handleLineDialogChange = (open: boolean) => {
    setIsAddLineDialogOpen(open);
    if (!open) {
      setLineForm({ name: "", description: "" });
      addLineMutation.reset();
    }
  };

  const handleAddLineSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addLineMutation.mutate(lineForm);
  };

  const addSubLineMutation = useMutation({
    mutationFn: async (data: typeof subLineForm) => {
      await apiRequest("POST", "/api/sub-lines", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-lines"] });
      setSubLineForm({ name: "", lineId: "" });
      setIsAddSubLineDialogOpen(false);
      toast({
        title: "Sub Line Created",
        description: "The new sub line has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create sub line",
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
    }
  };

  const handleAddSubLineSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addSubLineMutation.mutate(subLineForm);
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
      return await response.json();
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
      return await response.json();
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

  const handleDownloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        "Line Name": "Assembly Line A",
        "Line Description": "Optional description",
        "Sub Line Name": "Station 1",
        "Machine Code": "MAC-001",
        "Machine Name": "Press Machine",
        "Maintenance Frequency": "Monthly",
        "PM Plan Year": "Jan-Jun",
        "Machine Uptime": "1290",
        "Machine Type": "Hydraulic",
      },
    ]);

    XLSX.utils.book_append_sheet(workbook, worksheet, "MasterData");
    XLSX.writeFile(workbook, "master_data_template.xlsx");
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
            lineDescription: String(row["Line Description"] ?? "").trim(),
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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const isBulkUploading = bulkImportMutation.isPending;

  const machineSubLineOptions = machineForm.lineId
    ? subLines.filter((subLine) => subLine.lineId === machineForm.lineId)
    : [];

  const isSavingMachine = addMachineMutation.isPending || updateMachineMutation.isPending;
  const isEditingMachine = Boolean(editingMachineId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Master Data Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage lines, machines, employees, and problem types</p>
      </div>

      {isAdmin && (
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
            Required columns: Line Name, Sub Line Name (when adding machines), Machine Code, Machine Name, Maintenance Frequency (optional), PM Plan Year (optional), Machine Uptime (optional), Machine Type (optional), Line Description (optional).
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="lines" data-testid="tab-lines">Lines</TabsTrigger>
          <TabsTrigger value="sublines" data-testid="tab-sublines">Sub Lines</TabsTrigger>
          <TabsTrigger value="machines" data-testid="tab-machines">Machines</TabsTrigger>
          <TabsTrigger value="employees" data-testid="tab-employees">Employees</TabsTrigger>
          <TabsTrigger value="problems" data-testid="tab-problems">Problem Types</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="space-y-4">
          <div className="flex justify-end">
            {isAdmin && (
              <Button
                onClick={() => handleLineDialogChange(true)}
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
                ) : lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No lines found</TableCell>
                  </TableRow>
                ) : (
                  lines.map((line) => (
                    <TableRow key={line.id} data-testid={`row-line-${line.id}`}>
                      <TableCell className="font-medium">{line.name}</TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" data-testid={`button-edit-line-${line.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-line-${line.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
          {isAdmin && (
            <Dialog open={isAddLineDialogOpen} onOpenChange={handleLineDialogChange}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Line</DialogTitle>
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
                      disabled={addLineMutation.isPending}
                      data-testid="button-submit-add-line"
                    >
                      {addLineMutation.isPending ? "Saving..." : "Save Line"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="sublines" className="space-y-4">
          <div className="flex justify-end">
            {isAdmin && (
              <Button
                onClick={() => handleSubLineDialogChange(true)}
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
                ) : subLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No sub lines found</TableCell>
                  </TableRow>
                ) : (
                  subLines.map((subLine) => {
                    const parentLine = lines.find((line) => line.id === subLine.lineId);
                    return (
                      <TableRow key={subLine.id} data-testid={`row-subline-${subLine.id}`}>
                        <TableCell className="font-medium">{subLine.name}</TableCell>
                        <TableCell>{parentLine?.name || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="icon" variant="ghost" data-testid={`button-edit-subline-${subLine.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" data-testid={`button-delete-subline-${subLine.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
          {isAdmin && (
            <Dialog open={isAddSubLineDialogOpen} onOpenChange={handleSubLineDialogChange}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Sub Line</DialogTitle>
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
                      disabled={addSubLineMutation.isPending || !subLineForm.lineId}
                      data-testid="button-submit-add-subline"
                    >
                      {addSubLineMutation.isPending ? "Saving..." : "Save Sub Line"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="machines" className="space-y-4">
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
                    <TableCell colSpan={9} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : machines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">No machines found</TableCell>
                  </TableRow>
                ) : (
                  machines.map((machine) => {
                    const lineId = resolveLineId(machine);
                    const subLineId = resolveSubLineId(machine);
                    const line = lines.find((l) => l.id === lineId);
                    const subLine = subLines.find((sl) => sl.id === subLineId);
                    const machineCode = resolveMachineCode(machine, machineCodeOverrides);
                    const maintenanceFrequency = resolveMaintenanceFrequency(machine);
                    const pmPlanYear = resolvePmPlanYear(machine);
                    const uptime = resolveUptime(machine);
                    return (
                      <TableRow key={machine.id} data-testid={`row-machine-${machine.id}`}>
                        <TableCell>{line?.name || '-'}</TableCell>
                        <TableCell>{subLine?.name || '-'}</TableCell>
                        <TableCell className="font-mono">{machineCode || '-'}</TableCell>
                        <TableCell className="font-medium">{machine.name}</TableCell>
                        <TableCell>{machine.type || '-'}</TableCell>
                        <TableCell>{maintenanceFrequency || '-'}</TableCell>
                        <TableCell>{pmPlanYear || '-'}</TableCell>
                        <TableCell>{uptime || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditMachine(machine)}
                              data-testid={`button-edit-machine-${machine.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" data-testid={`button-delete-machine-${machine.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
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
                    <Input
                      id="machine-frequency"
                      value={machineForm.maintenanceFrequency}
                      onChange={(event) =>
                        setMachineForm((prev) => ({ ...prev, maintenanceFrequency: event.target.value.trim() }))
                      }
                      placeholder="e.g. Weekly, Monthly (optional)"
                      data-testid="input-machine-frequency"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machine-plan-year">PM Plan Year</Label>
                    <Input
                      id="machine-plan-year"
                      value={machineForm.pmPlanYear}
                      onChange={(event) =>
                        setMachineForm((prev) => ({ ...prev, pmPlanYear: event.target.value.trim() }))
                      }
                      placeholder="e.g. Jan-Jun (optional)"
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
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex justify-end">
            <Button data-testid="button-add-employee">
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
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
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No employees found</TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.role || '-'}</TableCell>
                      <TableCell>{employee.department || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" data-testid={`button-edit-employee-${employee.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-employee-${employee.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="problems" className="space-y-4">
          <div className="flex justify-end">
            <Button data-testid="button-add-problem">
              <Plus className="h-4 w-4 mr-2" />
              Add Problem Type
            </Button>
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
                ) : problemTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No problem types found</TableCell>
                  </TableRow>
                ) : (
                  problemTypes.map((problemType) => (
                    <TableRow key={problemType.id} data-testid={`row-problem-${problemType.id}`}>
                      <TableCell className="font-medium">{problemType.name}</TableCell>
                      <TableCell>{problemType.description || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" data-testid={`button-edit-problem-${problemType.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-problem-${problemType.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
