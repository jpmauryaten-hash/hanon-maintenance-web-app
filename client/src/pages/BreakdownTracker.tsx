import { useEffect, useMemo, useState } from "react";
import BreakdownForm from "@/components/BreakdownForm";
import BreakdownTable from "@/components/BreakdownTable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const PAGE_SIZE = 15;
const SHIFT_OPTIONS = ["A", "B", "C"];
const STATUS_OPTIONS = ["open", "pending", "closed"];

export default function BreakdownTracker() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBreakdown, setEditingBreakdown] = useState<any>(null);
  const [viewingBreakdown, setViewingBreakdown] = useState<any>(null);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    shift: "",
    lineId: "",
    machineId: "",
    status: "",
  });
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/lines"] });
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });

  const { data: breakdownResponse, isFetching: isLoadingBreakdowns } = useQuery<any>({
    queryKey: ["/api/breakdowns", filters, page, PAGE_SIZE],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.shift) params.set("shift", filters.shift);
      if (filters.lineId) params.set("lineId", filters.lineId);
      if (filters.machineId) params.set("machineId", filters.machineId);
      if (filters.status) params.set("status", filters.status);

      const res = await apiRequest("GET", `/api/breakdowns?${params.toString()}`);
      return res.json();
    },
    keepPreviousData: true,
  });

  const breakdowns = useMemo(() => {
    if (Array.isArray(breakdownResponse)) {
      return breakdownResponse.filter((item: any) => !item?.deletedAt);
    }
    return (breakdownResponse?.items ?? []).filter((item: any) => !item?.deletedAt);
  }, [breakdownResponse]);

  const meta = useMemo(() => {
    if (Array.isArray(breakdownResponse)) {
      return null;
    }
    return breakdownResponse?.meta ?? null;
  }, [breakdownResponse]);

  useEffect(() => {
    if (!meta) {
      return;
    }
    if (meta.totalPages === 0 && page !== 1) {
      setPage(1);
      return;
    }
    if (meta.totalPages && page > meta.totalPages) {
      setPage(meta.totalPages);
    }
  }, [meta, page]);

  const totalPages = useMemo(() => {
    if (meta?.totalPages) {
      return Math.max(1, meta.totalPages);
    }
    return Math.max(1, Math.ceil(breakdowns.length / PAGE_SIZE));
  }, [breakdowns.length, meta?.totalPages]);

  const totalItems = meta?.total ?? breakdowns.length;
  const startEntry = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endEntry = totalItems === 0 ? 0 : Math.min(totalItems, page * PAGE_SIZE);

  const filteredMachines = useMemo(() => {
    if (!filters.lineId) {
      return machines;
    }
    return machines.filter((machine: any) => machine.lineId === filters.lineId);
  }, [filters.lineId, machines]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    const nextValue = value === "all" ? "" : value;
    setFilters((prev) => {
      const next = { ...prev, [key]: nextValue };
      if (key === "lineId") {
        next.machineId = "";
      }
      return next;
    });
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      shift: "",
      lineId: "",
      machineId: "",
      status: "",
    });
    setPage(1);
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/breakdowns", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breakdowns"] });
      setIsFormOpen(false);
      toast({
        title: "Success",
        description: "Breakdown entry created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create breakdown entry",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PUT", `/api/breakdowns/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breakdowns"] });
      setEditingBreakdown(null);
      toast({
        title: "Success",
        description: "Breakdown entry updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update breakdown entry",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/breakdowns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breakdowns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/breakdowns/deleted"] });
      toast({
        title: "Success",
        description: "Breakdown entry deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete breakdown entry",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: any) => {
    if (editingBreakdown) {
      updateMutation.mutate({ id: editingBreakdown.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleView = (id: string) => {
    const breakdown = breakdowns.find((b: any) => b.id === id);
    if (breakdown) {
      setViewingBreakdown(breakdown);
    }
  };

  const handleEdit = (id: string) => {
    const breakdown = breakdowns.find((b: any) => b.id === id);
    if (breakdown) {
      setEditingBreakdown(breakdown);
    }
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) {
      return;
    }
    const confirmed = window.confirm("Are you sure you want to delete this breakdown?");
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(id);
  };

  const handleCloseDialog = () => {
    setIsFormOpen(false);
    setEditingBreakdown(null);
  };

  const handleCloseViewDialog = () => {
    setViewingBreakdown(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Breakdown Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Record and manage breakdown entries</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} data-testid="button-add-breakdown">
          <Plus className="h-4 w-4 mr-2" />
          Add Breakdown
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Filters</h2>
            <p className="text-sm text-muted-foreground">
              Narrow down breakdowns by date range, shift, line, machine, and status.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleResetFilters}>
              Clear filters
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label>From Date</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(event) => handleFilterChange("startDate", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>To Date</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(event) => handleFilterChange("endDate", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Shift</Label>
            <Select value={filters.shift} onValueChange={(value) => handleFilterChange("shift", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All shifts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All shifts</SelectItem>
                {SHIFT_OPTIONS.map((shift) => (
                  <SelectItem key={shift} value={shift}>
                    Shift {shift}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Line</Label>
            <Select value={filters.lineId} onValueChange={(value) => handleFilterChange("lineId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lines</SelectItem>
                {lines.map((line: any) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Machine</Label>
            <Select
              value={filters.machineId}
              onValueChange={(value) => handleFilterChange("machineId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={filters.lineId ? "Select machine" : "All machines"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All machines</SelectItem>
                {filteredMachines.map((machine: any) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <BreakdownTable
        breakdowns={breakdowns}
        canEdit={true}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={isAdmin ? handleDelete : undefined}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {isLoadingBreakdowns
            ? "Loading breakdowns..."
            : totalItems > 0
              ? `Showing ${startEntry}-${endEntry} of ${totalItems}`
              : "No breakdowns match your filters."}
        </div>
        <Pagination className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPage((prev) => Math.max(1, prev - 1));
                }}
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground px-4 py-2">
                Page {page} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPage((prev) => Math.min(totalPages, prev + 1));
                }}
                aria-disabled={page === totalPages}
                className={page === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      <Dialog open={isFormOpen || !!editingBreakdown} onOpenChange={handleCloseDialog}>
        <DialogContent className="w-[96vw] max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBreakdown ? 'Edit Breakdown Entry' : 'New Breakdown Entry'}</DialogTitle>
          </DialogHeader>
          <BreakdownForm 
            onSubmit={handleSubmit}
            onCancel={handleCloseDialog}
            initialData={editingBreakdown}
            canEditClosed={isAdmin}
            canUseBackDates={isAdmin}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingBreakdown} onOpenChange={handleCloseViewDialog}>
        <DialogContent className="w-[96vw] max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Breakdown Entry</DialogTitle>
          </DialogHeader>
          {viewingBreakdown && <BreakdownView breakdown={viewingBreakdown} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BreakdownView({ breakdown }: { breakdown: any }) {
  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/lines"] });
  const { data: subLines = [] } = useQuery<any[]>({ queryKey: ["/api/sub-lines"] });
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });
  const { data: problemTypes = [] } = useQuery<any[]>({ queryKey: ["/api/problem-types"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const normalizePriority = (value: string | null | undefined) => {
    if (!value) return "-";
    if (value === "High") return "Critical";
    if (value === "Medium" || value === "Low") return "Non-Critical";
    return value;
  };

  const line = lines.find(l => l.id === breakdown.lineId)?.name;
  const subLine = subLines.find(sl => sl.id === breakdown.subLineId)?.name;
  const machine = machines.find(m => m.id === breakdown.machineId)?.name;
  const problemType = problemTypes.find(pt => pt.id === breakdown.problemTypeId)?.name;
  const attendBy = employees.find(e => e.id === breakdown.attendById)?.name;
  const closedBy = employees.find(e => e.id === breakdown.closedById)?.name;

  let problemDescriptions = [];
  let rootCauses = [];
  let preventiveActions = [];

  try {
    if (breakdown.capaProblemDescriptions) {
      problemDescriptions = JSON.parse(breakdown.capaProblemDescriptions);
    }
  } catch {}

  try {
    if (breakdown.capaRootCauses) {
      rootCauses = JSON.parse(breakdown.capaRootCauses);
    }
  } catch {}

  try {
    if (breakdown.capaPreventiveActions) {
      preventiveActions = JSON.parse(breakdown.capaPreventiveActions);
    }
  } catch {}

  const displayPriority = normalizePriority(breakdown.priority);
  const isCapaRequired = parseInt(breakdown.totalMinutes || '0') > 45;

  return (
    <div className="space-y-6">
      <div className="border rounded-md">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50 w-1/4">Date</td>
              <td className="p-3 font-mono">{breakdown.date}</td>
              <td className="font-semibold p-3 bg-muted/50 w-1/4">Shift</td>
              <td className="p-3">{breakdown.shift}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Priority</td>
              <td className="p-3">{displayPriority}</td>
              <td className="font-semibold p-3 bg-muted/50">Status</td>
              <td className="p-3">{breakdown.status}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Line</td>
              <td className="p-3">{line}</td>
              <td className="font-semibold p-3 bg-muted/50">Sub Line</td>
              <td className="p-3">{subLine || '-'}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Machine</td>
              <td className="p-3">{machine}</td>
              <td className="font-semibold p-3 bg-muted/50">Problem Type</td>
              <td className="p-3">{problemType}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Problem Description</td>
              <td className="p-3" colSpan={3}>{breakdown.problemDescription || '-'}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Start Time</td>
              <td className="p-3 font-mono">{breakdown.startTime}</td>
              <td className="font-semibold p-3 bg-muted/50">Finish Time</td>
              <td className="p-3 font-mono">{breakdown.finishTime || '-'}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Total Minutes</td>
              <td className="p-3 font-mono">{breakdown.totalMinutes || '-'}</td>
              <td className="font-semibold p-3 bg-muted/50">Major Contribution Time</td>
              <td className="p-3 font-mono">{breakdown.majorContributionTime || '-'}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Action Taken</td>
              <td className="p-3" colSpan={3}>{breakdown.actionTaken || '-'}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Root Cause</td>
              <td className="p-3" colSpan={3}>{breakdown.rootCause || '-'}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Major Contribution</td>
              <td className="p-3" colSpan={3}>{breakdown.majorContribution || '-'}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Attended By</td>
              <td className="p-3">{attendBy}</td>
              <td className="font-semibold p-3 bg-muted/50">Closed By</td>
              <td className="p-3">{closedBy || '-'}</td>
            </tr>
            <tr className="border-b">
              <td className="font-semibold p-3 bg-muted/50">Closed Date</td>
              <td className="p-3 font-mono">{breakdown.closedDate || '-'}</td>
              <td className="font-semibold p-3 bg-muted/50">Remark</td>
              <td className="p-3">{breakdown.remark || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {isCapaRequired && (
        <>
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">CAPA Sheet - Five Why Analysis</h3>
          </div>

          <div className="border rounded-md">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="font-semibold p-3 bg-muted/50 w-1/4">Operator</td>
                  <td className="p-3">{breakdown.capaOperator || '-'}</td>
                  <td className="font-semibold p-3 bg-muted/50 w-1/4">Maintenance</td>
                  <td className="p-3">{breakdown.capaMaintenance || '-'}</td>
                </tr>
                <tr className="border-b">
                  <td className="font-semibold p-3 bg-muted/50">What Happened</td>
                  <td className="p-3" colSpan={3}>{breakdown.capaWhatHappened || '-'}</td>
                </tr>
                <tr className="border-b">
                  <td className="font-semibold p-3 bg-muted/50">Failure Mode</td>
                  <td className="p-3" colSpan={3}>{breakdown.capaFailureMode || '-'}</td>
                </tr>
                <tr>
                  <td className="font-semibold p-3 bg-muted/50">Sketch</td>
                  <td className="p-3" colSpan={3}>{breakdown.capaSketch || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {problemDescriptions.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">Problem Descriptions (Five Whys)</h4>
              {problemDescriptions.map((problem: any, index: number) => (
                <div key={index} className="border rounded-md mb-4">
                  <div className="bg-muted/50 p-3 font-semibold border-b">Problem {index + 1}</div>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b">
                        <td className="font-semibold p-3 bg-muted/50 w-1/4">Description</td>
                        <td className="p-3" colSpan={3}>{problem.description || '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="font-semibold p-3 bg-muted/50">Why 1</td>
                        <td className="p-3">{problem.why1 || '-'}</td>
                        <td className="font-semibold p-3 bg-muted/50 w-1/4">Check 1</td>
                        <td className="p-3">{problem.check1 || '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="font-semibold p-3 bg-muted/50">Why 2</td>
                        <td className="p-3">{problem.why2 || '-'}</td>
                        <td className="font-semibold p-3 bg-muted/50">Check 2</td>
                        <td className="p-3">{problem.check2 || '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="font-semibold p-3 bg-muted/50">Why 3</td>
                        <td className="p-3">{problem.why3 || '-'}</td>
                        <td className="font-semibold p-3 bg-muted/50">Check 3</td>
                        <td className="p-3">{problem.check3 || '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="font-semibold p-3 bg-muted/50">Why 4</td>
                        <td className="p-3">{problem.why4 || '-'}</td>
                        <td className="font-semibold p-3 bg-muted/50">Check 4</td>
                        <td className="p-3">{problem.check4 || '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="font-semibold p-3 bg-muted/50">Why 5</td>
                        <td className="p-3">{problem.why5 || '-'}</td>
                        <td className="font-semibold p-3 bg-muted/50">Check 5</td>
                        <td className="p-3">{problem.check5 || '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="font-semibold p-3 bg-muted/50">4M Category</td>
                        <td className="p-3" colSpan={3}>{problem.category || '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="font-semibold p-3 bg-muted/50">Corrective Action</td>
                        <td className="p-3" colSpan={3}>{problem.correctiveAction || '-'}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold p-3 bg-muted/50">Preventive Action</td>
                        <td className="p-3" colSpan={3}>{problem.preventiveAction || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {rootCauses.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">Root Causes & Countermeasures</h4>
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="p-3 text-left font-semibold">#</th>
                      <th className="p-3 text-left font-semibold">Root Cause</th>
                      <th className="p-3 text-left font-semibold">4M Category</th>
                      <th className="p-3 text-left font-semibold">Countermeasures</th>
                      <th className="p-3 text-left font-semibold">Evidence Before</th>
                      <th className="p-3 text-left font-semibold">Evidence After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rootCauses.map((rc: any, index: number) => (
                      <tr key={index} className={index < rootCauses.length - 1 ? 'border-b' : ''}>
                        <td className="p-3">{index + 1}</td>
                        <td className="p-3">{rc.rootCause || '-'}</td>
                        <td className="p-3">{rc.category || '-'}</td>
                        <td className="p-3">{rc.countermeasures || '-'}</td>
                        <td className="p-3">{rc.evidenceBefore || '-'}</td>
                        <td className="p-3">{rc.evidenceAfter || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preventiveActions.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">Preventive Action Plan</h4>
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="p-3 text-left font-semibold">#</th>
                      <th className="p-3 text-left font-semibold">Description</th>
                      <th className="p-3 text-left font-semibold">By Whom</th>
                      <th className="p-3 text-left font-semibold">Action</th>
                      <th className="p-3 text-left font-semibold">Evidence 1</th>
                      <th className="p-3 text-left font-semibold">Evidence 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preventiveActions.map((pa: any, index: number) => (
                      <tr key={index} className={index < preventiveActions.length - 1 ? 'border-b' : ''}>
                        <td className="p-3">{index + 1}</td>
                        <td className="p-3">{pa.description || '-'}</td>
                        <td className="p-3">{pa.byWhom || '-'}</td>
                        <td className="p-3">{pa.action || '-'}</td>
                        <td className="p-3">{pa.evidence1 || '-'}</td>
                        <td className="p-3">{pa.evidence2 || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="border rounded-md">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="font-semibold p-3 bg-muted/50">Prepared By</td>
                  <td className="p-3">{breakdown.capaPreparedBy || '-'}</td>
                  <td className="font-semibold p-3 bg-muted/50">Checked By</td>
                  <td className="p-3">{breakdown.capaCheckedBy || '-'}</td>
                  <td className="font-semibold p-3 bg-muted/50">Reviewed By</td>
                  <td className="p-3">{breakdown.capaReviewedBy || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
