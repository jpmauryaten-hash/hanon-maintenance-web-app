import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { ArrowUpDown, Download, RefreshCcw, Info } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/queryClient";

const REPORT_DEFINITIONS = [
  {
    slug: "bd",
    title: "BD Report",
    description: "Analyze detailed breakdown history with downtime analytics and corrective actions.",
    implemented: true,
  },
  {
    slug: "annual-pm",
    title: "Annual PM Report",
    description: "Planned vs completed annual preventive maintenance schedules.",
    implemented: true,
  },
  {
    slug: "monthly-pm",
    title: "Monthly Preventive M Report",
    description: "Month-wise preventive maintenance compliance and status tracking.",
    implemented: true,
  },
  {
    slug: "annual-predictive",
    title: "Annual Predictive M Report",
    description: "Predictive maintenance plan adherence across the selected year.",
    implemented: true,
  },
  {
    slug: "monthly-predictive",
    title: "Monthly Predictive M Report",
    description: "Predictive maintenance completion trends for a given month.",
    implemented: true,
  },
  {
    slug: "overhaul",
    title: "Overhaul M Report",
    description: "Track overhaul maintenance plans, execution, and delays.",
    implemented: true,
  },
  {
    slug: "long-pending",
    title: "Long Pending Issue",
    description: "Identify breakdowns exceeding the SLA or awaiting closure.",
    implemented: true,
  },
] as const;

type ReportDefinition = (typeof REPORT_DEFINITIONS)[number];
const DEFAULT_REPORT = REPORT_DEFINITIONS[0];

const ALL_OPTION = "__all__";

const REPORT_COMPONENTS: Record<string, (props: { definition: ReportDefinition }) => JSX.Element> = {
  bd: BdReportView,
  "long-pending": LongPendingReportView,
  "annual-pm": AnnualPmReportView,
  "annual-predictive": AnnualPredictiveReportView,
  overhaul: OverhaulReportView,
  "monthly-pm": MonthlyPmReportView,
  "monthly-predictive": MonthlyPredictiveReportView,
};

export default function Reports() {
  const [match, params] = useRoute<{ view?: string }>("/reports/:view");
  const routeSlug = match ? params?.view ?? null : null;
  const querySlug =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("view")
      : null;
  const requestedSlug = routeSlug ?? querySlug;
  const definition = REPORT_DEFINITIONS.find((report) => report.slug === requestedSlug) ?? DEFAULT_REPORT;

  const ReportComponent = REPORT_COMPONENTS[definition.slug];
  if (ReportComponent) {
    return <ReportComponent definition={definition} />;
  }

  return <ReportPlaceholder definition={definition} />;
}

type SortDirection = "asc" | "desc";
type SortState<K extends string> = {
  key: K;
  direction: SortDirection;
};

type BdSortKey = "date" | "lineName" | "machineName" | "machineCode" | "status" | "bdTotalMinutes";
type LongPendingSortKey = "date" | "lineName" | "machineName" | "status" | "daysPending";

interface BdReportRecord {
  id: string;
  date: string | null;
  lineName: string | null;
  subLineName: string | null;
  machineCode: string | null;
  machineName: string | null;
  maintenanceType: string | null;
  problemType: string | null;
  bdStartTime: string | null;
  bdCloseTime: string | null;
  bdTotalMinutes: number | null;
  bdTotalTime: string | null;
  majorContributionBy: string | null;
  majorContributionTime: number | null;
  problem: string | null;
  action: string | null;
  rootCause: string | null;
  status: string | null;
}

interface LongPendingRecord {
  id: string;
  serialNumber: number;
  date: string | null;
  lineName: string | null;
  subLineName: string | null;
  machineName: string | null;
  machineCode: string | null;
  priority: string | null;
  status: string | null;
  daysPending: number;
  problemDescription: string | null;
  actionTaken: string | null;
  rootCause: string | null;
  problemType: string | null;
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  lineId: string;
  subLineId: string;
  machineId: string;
  status: string;
  problemTypeId: string;
}

interface LongPendingFilters {
  lineId: string;
  subLineId: string;
  machineId: string;
  problemTypeId: string;
  status: string;
  minDays: string;
}

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["open", "pending", "closed"];
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  pending: "Pending",
  closed: "Closed",
};
const BD_REPORT_HEADERS = [
  "Date",
  "Line Name",
  "Sub Line Name",
  "Machine Code",
  "Machine Name",
  "Maintenance Type",
  "Problem Type",
  "BD Start Time",
  "BD Close Time",
  "BD total Time",
  "Major Contribution by",
  "Major Contribution Time",
  "Problem",
  "Action",
  "Root cause",
  "Status",
];

const isAll = (value: string) => value === ALL_OPTION;

const getDefaultFilters = (): ReportFilters => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    startDate: format(startOfMonth, "yyyy-MM-dd"),
    endDate: format(today, "yyyy-MM-dd"),
    lineId: ALL_OPTION,
    subLineId: ALL_OPTION,
    machineId: ALL_OPTION,
    status: ALL_OPTION,
    problemTypeId: ALL_OPTION,
  };
};

const getLongPendingDefaultFilters = (): LongPendingFilters => ({
  lineId: ALL_OPTION,
  subLineId: ALL_OPTION,
  machineId: ALL_OPTION,
  problemTypeId: ALL_OPTION,
  status: "open",
  minDays: "7",
});

const formatDuration = (minutes: number | null | undefined, fallbackText = "-"): string => {
  if (minutes == null || Number.isNaN(minutes)) {
    return fallbackText;
  }
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

const formatDateDisplay = (value: string | null): string => {
  if (!value) {
    return "-";
  }
  return value;
};

const formatStatus = (value: string | null): string => {
  if (!value) {
    return "-";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
};

type AnnualPmSortKey = "pmPlanDate" | "lineName" | "machineName" | "machineCode" | "status";

interface AnnualPmReportRecord {
  serialNumber?: number;
  pmPlanDate: string | null;
  lineName: string | null;
  subLineName: string | null;
  machineName: string | null;
  machineCode: string | null;
  machineType: string | null;
  frequency: string | null;
  status: string;
  remarks: string | null;
}

interface AnnualPmFilters {
  year: string;
  lineId: string;
  subLineId: string;
  machineId: string;
  frequency: string;
  status: string;
}

const ANNUAL_PM_HEADERS = [
  "S. No.",
  "PM Plan Date",
  "Line",
  "Sub Line",
  "Machine Name",
  "Machine Code",
  "Machine Type",
  "Frequency",
  "Status",
  "Remarks",
];

const ANNUAL_PM_STATUS_OPTIONS = ["Planned", "Pending", "Completed", "Delayed"];
const PM_FREQUENCY_OPTIONS = ["Yearly", "Half Yearly", "Quarterly", "Monthly"];
const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const getAnnualPmDefaultFilters = (): AnnualPmFilters => ({
  year: String(new Date().getFullYear()),
  lineId: ALL_OPTION,
  subLineId: ALL_OPTION,
  machineId: ALL_OPTION,
  frequency: "Yearly",
  status: ALL_OPTION,
});

const getAnnualPredictiveDefaultFilters = (): AnnualPmFilters => ({
  year: String(new Date().getFullYear()),
  lineId: ALL_OPTION,
  subLineId: ALL_OPTION,
  machineId: ALL_OPTION,
  frequency: ALL_OPTION,
  status: ALL_OPTION,
});

interface AnnualMaintenanceReportConfig {
  queryKey: string;
  endpoint: string;
  defaultFilters: () => AnnualPmFilters;
  staticParams?: Record<string, string>;
}

const ANNUAL_PM_REPORT_CONFIG: AnnualMaintenanceReportConfig = {
  queryKey: "annual-pm-report",
  endpoint: "/api/reports/annual-pm",
  defaultFilters: getAnnualPmDefaultFilters,
};

const ANNUAL_PREDICTIVE_REPORT_CONFIG: AnnualMaintenanceReportConfig = {
  queryKey: "annual-predictive-report",
  endpoint: "/api/reports/annual-predictive",
  defaultFilters: getAnnualPredictiveDefaultFilters,
  staticParams: {
    maintenanceType: "Predictive",
  },
};

const OVERHAUL_REPORT_CONFIG: AnnualMaintenanceReportConfig = {
  queryKey: "overhaul-report",
  endpoint: "/api/reports/annual-pm",
  defaultFilters: getAnnualPredictiveDefaultFilters,
  staticParams: {
    maintenanceType: "Overhauling",
  },
};

interface MonthlyPmFilters {
  year: string;
  month: string;
  lineId: string;
  subLineId: string;
  machineId: string;
  status: string;
}

const getMonthlyPmDefaultFilters = (): MonthlyPmFilters => {
  const today = new Date();
  return {
    year: String(today.getFullYear()),
    month: String(today.getMonth() + 1),
    lineId: ALL_OPTION,
    subLineId: ALL_OPTION,
    machineId: ALL_OPTION,
    status: ALL_OPTION,
  };
};

const getMonthlyPredictiveDefaultFilters = (): MonthlyPmFilters => ({
  ...getMonthlyPmDefaultFilters(),
});

interface MonthlyMaintenanceReportConfig {
  queryKey: string;
  endpoint: string;
  defaultFilters: () => MonthlyPmFilters;
  staticParams?: Record<string, string>;
}

const MONTHLY_PM_REPORT_CONFIG: MonthlyMaintenanceReportConfig = {
  queryKey: "monthly-pm-report",
  endpoint: "/api/reports/monthly-pm",
  defaultFilters: getMonthlyPmDefaultFilters,
};

const MONTHLY_PREDICTIVE_REPORT_CONFIG: MonthlyMaintenanceReportConfig = {
  queryKey: "monthly-predictive-report",
  endpoint: "/api/reports/monthly-pm",
  defaultFilters: getMonthlyPredictiveDefaultFilters,
  staticParams: {
    maintenanceType: "Predictive",
  },
};

function BdReportView({ definition }: { definition: ReportDefinition }) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportFilters>(() => getDefaultFilters());
  const [sortConfig, setSortConfig] = useState<SortState<BdSortKey>>({
    key: "date",
    direction: "desc",
  });
  const [page, setPage] = useState(1);

  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/lines"] });
  const { data: subLines = [] } = useQuery<any[]>({ queryKey: ["/api/sub-lines"] });
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });
  const { data: problemTypes = [] } = useQuery<any[]>({ queryKey: ["/api/problem-types"] });

  const bdQuery = useQuery<BdReportRecord[]>({
    queryKey: ["bd-report", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (!isAll(filters.lineId)) params.set("lineId", filters.lineId);
      if (!isAll(filters.subLineId)) params.set("subLineId", filters.subLineId);
      if (!isAll(filters.machineId)) params.set("machineId", filters.machineId);
      if (!isAll(filters.status)) params.set("status", filters.status);
      if (!isAll(filters.problemTypeId)) params.set("problemTypeId", filters.problemTypeId);

      const query = params.toString();
      const response = await fetch(
        resolveApiUrl(query ? `/api/reports/bd?${query}` : "/api/reports/bd"),
        { credentials: "include" },
      );
      if (!response.ok) {
        const message = (await response.text()) || response.statusText || "Failed to fetch BD report";
        throw new Error(message);
      }
      const payload = await response.json();
      return Array.isArray(payload?.data) ? payload.data : [];
    },
    refetchOnWindowFocus: false,
  });

  const reportData = bdQuery.data ?? [];
  const isFetching = bdQuery.isFetching;

  useEffect(() => {
    if (bdQuery.error instanceof Error) {
      toast({
        title: "Unable to load BD report",
        description: bdQuery.error.message,
        variant: "destructive",
      });
    }
  }, [bdQuery.error, toast]);

  const availableSubLines = useMemo(() => {
    if (isAll(filters.lineId)) {
      return [];
    }
    return subLines.filter((subLine) => subLine.lineId === filters.lineId);
  }, [filters.lineId, subLines]);

  const availableMachines = useMemo(() => {
    if (!isAll(filters.subLineId)) {
      return machines.filter((machine) => machine.subLineId === filters.subLineId);
    }
    if (!isAll(filters.lineId)) {
      return machines.filter((machine) => machine.lineId === filters.lineId);
    }
    return machines;
  }, [filters.lineId, filters.subLineId, machines]);

  useEffect(() => {
    setPage(1);
  }, [
    filters.startDate,
    filters.endDate,
    filters.lineId,
    filters.subLineId,
    filters.machineId,
    filters.status,
    filters.problemTypeId,
  ]);

  const handleSort = (key: BdSortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    const copy = [...reportData];
    copy.sort((a, b) => {
      const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
      const getString = (value: string | null | undefined) => (value ?? "").toLowerCase();
      const getNumber = (value: number | null | undefined) => (value == null ? -Infinity : value);

      let comparison = 0;
      switch (sortConfig.key) {
        case "date":
          comparison = getString(a.date).localeCompare(getString(b.date));
          break;
        case "lineName":
          comparison = getString(a.lineName).localeCompare(getString(b.lineName));
          break;
        case "machineName":
          comparison = getString(a.machineName).localeCompare(getString(b.machineName));
          break;
        case "machineCode":
          comparison = getString(a.machineCode).localeCompare(getString(b.machineCode));
          break;
        case "status":
          comparison = getString(a.status).localeCompare(getString(b.status));
          break;
        case "bdTotalMinutes":
          comparison = getNumber(a.bdTotalMinutes) - getNumber(b.bdTotalMinutes);
          break;
        default:
          comparison = 0;
      }
      return comparison * directionMultiplier;
    });
    return copy;
  }, [reportData, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedData = sortedData.slice(pageStart, pageEnd);

  const handleExport = () => {
    if (!reportData.length) {
      toast({
        title: "No data to export",
        description: "Adjust the filters to include at least one breakdown record.",
        variant: "destructive",
      });
      return;
    }

    const rows = reportData.map((record) => ({
      Date: formatDateDisplay(record.date),
      "Line Name": record.lineName ?? "-",
      "Sub Line Name": record.subLineName ?? "-",
      "Machine Code": record.machineCode ?? "-",
      "Machine Name": record.machineName ?? "-",
      "Maintenance Type": record.maintenanceType ?? "-",
      "Problem Type": record.problemType ?? "-",
      "BD Start Time": record.bdStartTime ?? "-",
      "BD Close Time": record.bdCloseTime ?? "-",
      "BD total Time": record.bdTotalTime ?? formatDuration(record.bdTotalMinutes),
      "Major Contribution by": record.majorContributionBy ?? "-",
      "Major Contribution Time":
        record.majorContributionTime != null ? `${record.majorContributionTime} min` : "-",
      Problem: record.problem ?? "-",
      Action: record.action ?? "-",
      "Root cause": record.rootCause ?? "-",
      Status: formatStatus(record.status),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: BD_REPORT_HEADERS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BD Report");
    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `${definition.slug}-report-${timestamp}.xlsx`);
  };

  const handleResetFilters = () => {
    setFilters(getDefaultFilters());
    setPage(1);
  };

  return (
    <ReportLayout definition={definition} onExport={handleExport} exportDisabled={!reportData.length || isFetching}>
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filters</h2>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={filters.startDate}
              max={filters.endDate}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, startDate: event.target.value ?? "" }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={filters.endDate}
              min={filters.startDate}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, endDate: event.target.value ?? "" }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="line-filter">Line</Label>
            <Select
              value={filters.lineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  lineId: value,
                  subLineId: ALL_OPTION,
                  machineId: ALL_OPTION,
                }))
              }
            >
              <SelectTrigger id="line-filter">
                <SelectValue placeholder="All lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All lines</SelectItem>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subline-filter">Sub Line</Label>
            <Select
              value={filters.subLineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  subLineId: value,
                  machineId: ALL_OPTION,
                }))
              }
              disabled={isAll(filters.lineId) || availableSubLines.length === 0}
            >
              <SelectTrigger id="subline-filter">
                <SelectValue
                  placeholder={isAll(filters.lineId) ? "Select a line first" : "All sub lines"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All sub lines</SelectItem>
                {availableSubLines.map((subLine) => (
                  <SelectItem key={subLine.id} value={subLine.id}>
                    {subLine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="machine-filter">Machine</Label>
            <Select
              value={filters.machineId}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, machineId: value }))}
            >
              <SelectTrigger id="machine-filter">
                <SelectValue placeholder="All machines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All machines</SelectItem>
                {availableMachines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All status</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {formatStatus(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="problem-type-filter">Problem Type</Label>
            <Select
              value={filters.problemTypeId}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, problemTypeId: value }))}
            >
              <SelectTrigger id="problem-type-filter">
                <SelectValue placeholder="All problem types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All problem types</SelectItem>
                {problemTypes.map((problemType) => (
                  <SelectItem key={problemType.id} value={problemType.id}>
                    {problemType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Results</h2>
          <p className="text-sm text-muted-foreground">
            Showing {reportData.length} breakdown{reportData.length === 1 ? "" : "s"} matching your
            criteria.
          </p>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader<BdSortKey> label="Date" sortKey="date" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader<BdSortKey>
                  label="Line Name"
                  sortKey="lineName"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <TableHead>Sub Line Name</TableHead>
                <SortableHeader<BdSortKey>
                  label="Machine Code"
                  sortKey="machineCode"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader<BdSortKey>
                  label="Machine Name"
                  sortKey="machineName"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <TableHead>Maintenance Type</TableHead>
                <TableHead>Problem Type</TableHead>
                <TableHead>BD Start Time</TableHead>
                <TableHead>BD Close Time</TableHead>
                <SortableHeader<BdSortKey>
                  label="BD total Time"
                  sortKey="bdTotalMinutes"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <TableHead>Major Contribution by</TableHead>
                <TableHead>Major Contribution Time</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Root cause</TableHead>
                <SortableHeader<BdSortKey>
                  label="Status"
                  sortKey="status"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching && (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-8 text-sm text-muted-foreground">
                    Loading report data...
                  </TableCell>
                </TableRow>
              )}

              {!isFetching && paginatedData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-8 text-sm text-muted-foreground">
                    No breakdowns match the selected filters.
                  </TableCell>
                </TableRow>
              )}

              {!isFetching &&
                paginatedData.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap">{formatDateDisplay(record.date)}</TableCell>
                    <TableCell>{record.lineName ?? "-"}</TableCell>
                    <TableCell>{record.subLineName ?? "-"}</TableCell>
                    <TableCell>{record.machineCode ?? "-"}</TableCell>
                    <TableCell>{record.machineName ?? "-"}</TableCell>
                    <TableCell>{record.maintenanceType ?? "-"}</TableCell>
                    <TableCell>{record.problemType ?? "-"}</TableCell>
                    <TableCell>{record.bdStartTime ?? "-"}</TableCell>
                    <TableCell>{record.bdCloseTime ?? "-"}</TableCell>
                    <TableCell>{record.bdTotalTime ?? formatDuration(record.bdTotalMinutes)}</TableCell>
                    <TableCell>{record.majorContributionBy ?? "-"}</TableCell>
                    <TableCell>
                      {record.majorContributionTime != null ? `${record.majorContributionTime} min` : "-"}
                    </TableCell>
                    <TableCell className="max-w-[240px] whitespace-pre-wrap text-sm">
                      {record.problem ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-[240px] whitespace-pre-wrap text-sm">
                      {record.action ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-[240px] whitespace-pre-wrap text-sm">
                      {record.rootCause ?? "-"}
                    </TableCell>
                    <TableCell>
                      {record.status ? (
                        <Badge variant="outline">{formatStatus(record.status)}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <Pagination className="pt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPage((prev) => Math.max(1, prev - 1));
                }}
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground px-4 py-2">
                Page {currentPage} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPage((prev) => Math.min(totalPages, prev + 1));
                }}
                aria-disabled={currentPage === totalPages}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Card>
    </ReportLayout>
  );
}

function LongPendingReportView({ definition }: { definition: ReportDefinition }) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<LongPendingFilters>(() => getLongPendingDefaultFilters());
  const [sortConfig, setSortConfig] = useState<SortState<LongPendingSortKey>>({
    key: "daysPending",
    direction: "desc",
  });
  const [page, setPage] = useState(1);

  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/lines"] });
  const { data: subLines = [] } = useQuery<any[]>({ queryKey: ["/api/sub-lines"] });
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });
  const { data: problemTypes = [] } = useQuery<any[]>({ queryKey: ["/api/problem-types"] });

  const longPendingQuery = useQuery<LongPendingRecord[]>({
    queryKey: ["long-pending-report", filters],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDaysValue = Number.parseInt(filters.minDays.replace(/[^0-9]/g, ""), 10);
      const minDays = Number.isFinite(minDaysValue) && minDaysValue > 0 ? minDaysValue : 7;

      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - Math.max(minDays + 30, 90));
      const params = new URLSearchParams();
      params.set("startDate", format(startDate, "yyyy-MM-dd"));
      params.set("endDate", format(today, "yyyy-MM-dd"));

      if (!isAll(filters.lineId)) params.set("lineId", filters.lineId);
      if (!isAll(filters.subLineId)) params.set("subLineId", filters.subLineId);
      if (!isAll(filters.machineId)) params.set("machineId", filters.machineId);
      if (!isAll(filters.problemTypeId)) params.set("problemTypeId", filters.problemTypeId);
      if (!isAll(filters.status)) params.set("status", filters.status);

      const query = params.toString();
      const response = await fetch(
        resolveApiUrl(query ? `/api/reports/bd?${query}` : "/api/reports/bd"),
        { credentials: "include" },
      );
      if (!response.ok) {
        const message =
          (await response.text()) || response.statusText || "Failed to fetch Long Pending report";
        throw new Error(message);
      }
      const payload = await response.json();
      const rawData = Array.isArray(payload?.data) ? payload.data : [];

      return rawData
        .map((record: BdReportRecord, index: number) => {
          const reportedDate = record.date ? new Date(record.date) : null;
          let daysPending = 0;
          if (reportedDate && !Number.isNaN(reportedDate.getTime())) {
            reportedDate.setHours(0, 0, 0, 0);
            const diff = today.getTime() - reportedDate.getTime();
            daysPending = diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
          }
          return {
            id: record.id,
            serialNumber: index + 1,
            date: record.date,
            lineName: record.lineName,
            subLineName: record.subLineName,
            machineName: record.machineName,
            machineCode: record.machineCode,
            priority: null,
            status: record.status,
            problemType: record.problemType,
            daysPending,
            problemDescription: record.problem,
            actionTaken: record.action,
            rootCause: record.rootCause,
          } as LongPendingRecord;
        })
        .filter((item: LongPendingRecord) => item.daysPending >= minDays)
        .sort((a: LongPendingRecord, b: LongPendingRecord) => b.daysPending - a.daysPending)
        .map((item: LongPendingRecord, index: number) => ({
          ...item,
          serialNumber: index + 1,
        }));
    },
    refetchOnWindowFocus: false,
  });

  const reportData = longPendingQuery.data ?? [];
  const isFetching = longPendingQuery.isFetching;

  useEffect(() => {
    if (longPendingQuery.error instanceof Error) {
      toast({
        title: "Unable to load Long Pending report",
        description: longPendingQuery.error.message,
        variant: "destructive",
      });
    }
  }, [longPendingQuery.error, toast]);

  const availableSubLines = useMemo(() => {
    if (isAll(filters.lineId)) {
      return [];
    }
    return subLines.filter((subLine) => subLine.lineId === filters.lineId);
  }, [filters.lineId, subLines]);

  const availableMachines = useMemo(() => {
    if (!isAll(filters.subLineId)) {
      return machines.filter((machine) => machine.subLineId === filters.subLineId);
    }
    if (!isAll(filters.lineId)) {
      return machines.filter((machine) => machine.lineId === filters.lineId);
    }
    return machines;
  }, [filters.lineId, filters.subLineId, machines]);

  useEffect(() => {
    setPage(1);
  }, [filters.lineId, filters.subLineId, filters.machineId, filters.problemTypeId, filters.status, filters.minDays]);

  const handleSort = (key: LongPendingSortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: key === "daysPending" ? "desc" : "asc" };
    });
  };

  const sortedData = useMemo(() => {
    const copy = [...reportData];
    copy.sort((a, b) => {
      const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
      const getString = (value: string | null | undefined) => (value ?? "").toLowerCase();

      let comparison = 0;
      switch (sortConfig.key) {
        case "date":
          comparison = getString(a.date).localeCompare(getString(b.date));
          break;
        case "lineName":
          comparison = getString(a.lineName).localeCompare(getString(b.lineName));
          break;
        case "machineName":
          comparison = getString(a.machineName).localeCompare(getString(b.machineName));
          break;
        case "status":
          comparison = getString(a.status).localeCompare(getString(b.status));
          break;
        case "daysPending":
          comparison = (a.daysPending ?? 0) - (b.daysPending ?? 0);
          break;
        default:
          comparison = 0;
      }
      return comparison * directionMultiplier;
    });
    return copy;
  }, [reportData, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedData = sortedData.slice(pageStart, pageEnd);

  const handleExport = () => {
    if (!reportData.length) {
      toast({
        title: "No data to export",
        description: "Adjust the filters to include at least one pending breakdown.",
        variant: "destructive",
      });
      return;
    }

    const rows = sortedData.map((record, index) => ({
      "S. No.": index + 1,
      Date: record.date ?? "-",
      "Days Pending": record.daysPending,
      Line: record.lineName ?? "-",
      "Sub Line": record.subLineName ?? "-",
      "Machine Name": record.machineName ?? "-",
      "Machine Code": record.machineCode ?? "-",
      "Problem Type": record.problemType ?? "-",
      Status: STATUS_LABELS[record.status ?? ""] ?? record.status ?? "-",
      Priority: record.priority ?? "-",
      Problem: record.problemDescription ?? "-",
      Action: record.actionTaken ?? "-",
      "Root Cause": record.rootCause ?? "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Long Pending Issues");
    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `${definition.slug}-report-${timestamp}.xlsx`);
  };

  const handleResetFilters = () => {
    setFilters(getLongPendingDefaultFilters());
    setPage(1);
  };

  return (
    <ReportLayout definition={definition} onExport={handleExport} exportDisabled={!reportData.length || isFetching}>
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filters</h2>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="long-pending-line-filter">Line</Label>
            <Select
              value={filters.lineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  lineId: value,
                  subLineId: ALL_OPTION,
                  machineId: ALL_OPTION,
                }))
              }
            >
              <SelectTrigger id="long-pending-line-filter">
                <SelectValue placeholder="All lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All lines</SelectItem>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="long-pending-subline-filter">Sub Line</Label>
            <Select
              value={filters.subLineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  subLineId: value,
                  machineId: ALL_OPTION,
                }))
              }
              disabled={isAll(filters.lineId) || availableSubLines.length === 0}
            >
              <SelectTrigger id="long-pending-subline-filter">
                <SelectValue
                  placeholder={isAll(filters.lineId) ? "Select a line first" : "All sub lines"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All sub lines</SelectItem>
                {availableSubLines.map((subLine) => (
                  <SelectItem key={subLine.id} value={subLine.id}>
                    {subLine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="long-pending-machine-filter">Machine</Label>
            <Select
              value={filters.machineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  machineId: value,
                }))
              }
              disabled={availableMachines.length === 0}
            >
              <SelectTrigger id="long-pending-machine-filter">
                <SelectValue placeholder="All machines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All machines</SelectItem>
                {availableMachines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="long-pending-problem-filter">Problem Type</Label>
            <Select
              value={filters.problemTypeId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  problemTypeId: value,
                }))
              }
            >
              <SelectTrigger id="long-pending-problem-filter">
                <SelectValue placeholder="All problem types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All problem types</SelectItem>
                {problemTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="long-pending-status-filter">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  status: value,
                }))
              }
            >
              <SelectTrigger id="long-pending-status-filter">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All status</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min-days-input">Minimum days pending</Label>
            <Input
              id="min-days-input"
              type="number"
              min={1}
              value={filters.minDays}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  minDays: event.target.value.replace(/[^0-9]/g, "").slice(0, 4),
                }))
              }
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S. No.</TableHead>
                <SortableHeader<LongPendingSortKey>
                  label="Report Date"
                  sortKey="date"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <SortableHeader<LongPendingSortKey>
                  label="Line"
                  sortKey="lineName"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <TableHead>Sub Line</TableHead>
                <SortableHeader<LongPendingSortKey>
                  label="Machine Name"
                  sortKey="machineName"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <TableHead>Machine Code</TableHead>
                <TableHead>Problem Type</TableHead>
                <TableHead>Priority</TableHead>
                <SortableHeader<LongPendingSortKey>
                  label="Status"
                  sortKey="status"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <SortableHeader<LongPendingSortKey>
                  label="Days Pending"
                  sortKey="daysPending"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <TableHead>Problem</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Root Cause</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground">
                    {isFetching
                      ? "Loading report data..."
                      : "No long pending breakdowns were found for the selected filters."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((record, index) => (
                  <TableRow key={record.id}>
                    <TableCell>{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                    <TableCell>{record.date ?? "-"}</TableCell>
                    <TableCell>{record.lineName ?? "-"}</TableCell>
                    <TableCell>{record.subLineName ?? "-"}</TableCell>
                    <TableCell>{record.machineName ?? "-"}</TableCell>
                    <TableCell>{record.machineCode ?? "-"}</TableCell>
                    <TableCell>{record.problemType ?? "-"}</TableCell>
                    <TableCell>{record.priority ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {STATUS_LABELS[record.status ?? ""] ?? record.status ?? "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{record.daysPending}</TableCell>
                    <TableCell className="max-w-[200px] whitespace-pre-wrap text-sm">
                      {record.problemDescription ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] whitespace-pre-wrap text-sm">
                      {record.actionTaken ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] whitespace-pre-wrap text-sm">
                      {record.rootCause ?? "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination className="pt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPage((prev) => Math.max(1, prev - 1));
                }}
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground px-4 py-2">
                Page {currentPage} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPage((prev) => Math.min(totalPages, prev + 1));
                }}
                aria-disabled={currentPage === totalPages}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Card>
    </ReportLayout>
  );
}

function AnnualPmReportView({ definition }: { definition: ReportDefinition }) {
  return (
    <AnnualMaintenanceReportView definition={definition} config={ANNUAL_PM_REPORT_CONFIG} />
  );
}

function AnnualPredictiveReportView({ definition }: { definition: ReportDefinition }) {
  return (
    <AnnualMaintenanceReportView
      definition={definition}
      config={ANNUAL_PREDICTIVE_REPORT_CONFIG}
    />
  );
}

function OverhaulReportView({ definition }: { definition: ReportDefinition }) {
  return (
    <AnnualMaintenanceReportView definition={definition} config={OVERHAUL_REPORT_CONFIG} />
  );
}

function AnnualMaintenanceReportView({
  definition,
  config,
}: {
  definition: ReportDefinition;
  config: AnnualMaintenanceReportConfig;
}) {
  const reportTitle = definition.title;
  const { queryKey, endpoint, defaultFilters, staticParams } = config;
  const { toast } = useToast();
  const [filters, setFilters] = useState<AnnualPmFilters>(() => defaultFilters());
  const [sortConfig, setSortConfig] = useState<SortState<AnnualPmSortKey>>({
    key: "pmPlanDate",
    direction: "asc",
  });
  const [page, setPage] = useState(1);

  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/lines"] });
  const { data: subLines = [] } = useQuery<any[]>({ queryKey: ["/api/sub-lines"] });
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });

  const annualQuery = useQuery<AnnualPmReportRecord[]>({
    queryKey: [queryKey, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      const parsedYear = Number.parseInt(filters.year, 10);
      const safeYear = Number.isFinite(parsedYear) ? String(parsedYear) : String(new Date().getFullYear());
      params.set("year", safeYear);
      if (!isAll(filters.lineId)) params.set("lineId", filters.lineId);
      if (!isAll(filters.subLineId)) params.set("subLineId", filters.subLineId);
      if (!isAll(filters.machineId)) params.set("machineId", filters.machineId);
      if (filters.frequency !== ALL_OPTION) params.set("frequency", filters.frequency);
      if (!isAll(filters.status)) params.set("status", filters.status);
      if (staticParams) {
        Object.entries(staticParams).forEach(([key, value]) => {
          if (value != null) {
            params.set(key, value);
          }
        });
      }

      const query = params.toString();
      const apiPath = query ? `${endpoint}?${query}` : endpoint;
      const response = await fetch(resolveApiUrl(apiPath), {
        credentials: "include",
      });
      if (!response.ok) {
        const message =
          (await response.text()) || response.statusText || `Failed to fetch ${reportTitle}`;
        throw new Error(message);
      }
      const payload = await response.json();
      return Array.isArray(payload?.data) ? payload.data : [];
    },
    refetchOnWindowFocus: false,
  });

  const reportData = annualQuery.data ?? [];
  const isFetching = annualQuery.isFetching;

  useEffect(() => {
    if (annualQuery.error instanceof Error) {
      toast({
        title: `Unable to load ${reportTitle}`,
        description: annualQuery.error.message,
        variant: "destructive",
      });
    }
  }, [annualQuery.error, toast, reportTitle]);

  const availableSubLines = useMemo(() => {
    if (isAll(filters.lineId)) {
      return [];
    }
    return subLines.filter((subLine) => subLine.lineId === filters.lineId);
  }, [filters.lineId, subLines]);

  const availableMachines = useMemo(() => {
    if (!isAll(filters.subLineId)) {
      return machines.filter((machine) => machine.subLineId === filters.subLineId);
    }
    if (!isAll(filters.lineId)) {
      return machines.filter((machine) => machine.lineId === filters.lineId);
    }
    return machines;
  }, [filters.lineId, filters.subLineId, machines]);

  useEffect(() => {
    setPage(1);
  }, [filters.year, filters.lineId, filters.subLineId, filters.machineId, filters.frequency, filters.status]);

  const handleSort = (key: AnnualPmSortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    const copy = [...reportData];
    copy.sort((a, b) => {
      const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
      const getString = (value: string | null | undefined) => (value ?? "").toLowerCase();

      let comparison = 0;
      switch (sortConfig.key) {
        case "pmPlanDate":
          comparison = getString(a.pmPlanDate).localeCompare(getString(b.pmPlanDate));
          break;
        case "lineName":
          comparison = getString(a.lineName).localeCompare(getString(b.lineName));
          break;
        case "machineName":
          comparison = getString(a.machineName).localeCompare(getString(b.machineName));
          break;
        case "machineCode":
          comparison = getString(a.machineCode).localeCompare(getString(b.machineCode));
          break;
        case "status":
          comparison = getString(a.status).localeCompare(getString(b.status));
          break;
        default:
          comparison = 0;
      }
      return comparison * directionMultiplier;
    });
    return copy;
  }, [reportData, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedData = sortedData.slice(pageStart, pageEnd);

  const handleExport = () => {
    if (!reportData.length) {
      toast({
        title: "No data to export",
        description: "Adjust the filters to include at least one maintenance schedule.",
        variant: "destructive",
      });
      return;
    }

    const rows = sortedData.map((record, index) => ({
      "S. No.": index + 1,
      "PM Plan Date": formatDateDisplay(record.pmPlanDate),
      Line: record.lineName ?? "-",
      "Sub Line": record.subLineName ?? "-",
      "Machine Name": record.machineName ?? "-",
      "Machine Code": record.machineCode ?? "-",
      "Machine Type": record.machineType ?? "-",
      Frequency: record.frequency ?? "-",
      Status: record.status ?? "-",
      Remarks: record.remarks ?? "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: ANNUAL_PM_HEADERS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reportTitle);
    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `${definition.slug}-report-${timestamp}.xlsx`);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters());
    setPage(1);
  };

  const displayYear = filters.year || String(new Date().getFullYear());

  return (
    <ReportLayout
      definition={definition}
      onExport={handleExport}
      exportDisabled={!reportData.length || isFetching}
    >
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filters</h2>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="annual-year-input">Year</Label>
            <Input
              id="annual-year-input"
              type="number"
              min={2000}
              max={9999}
              value={displayYear}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  year: event.target.value.replace(/[^0-9]/g, "").slice(0, 4),
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="line-filter">Line</Label>
            <Select
              value={filters.lineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  lineId: value,
                  subLineId: ALL_OPTION,
                  machineId: ALL_OPTION,
                }))
              }
            >
              <SelectTrigger id="line-filter">
                <SelectValue placeholder="All lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All lines</SelectItem>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subline-filter">Sub Line</Label>
            <Select
              value={filters.subLineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  subLineId: value,
                  machineId: ALL_OPTION,
                }))
              }
              disabled={isAll(filters.lineId) || availableSubLines.length === 0}
            >
              <SelectTrigger id="subline-filter">
                <SelectValue
                  placeholder={isAll(filters.lineId) ? "Select a line first" : "All sub lines"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All sub lines</SelectItem>
                {availableSubLines.map((subLine) => (
                  <SelectItem key={subLine.id} value={subLine.id}>
                    {subLine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="machine-filter">Machine</Label>
            <Select
              value={filters.machineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  machineId: value,
                }))
              }
              disabled={availableMachines.length === 0}
            >
              <SelectTrigger id="machine-filter">
                <SelectValue placeholder="All machines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All machines</SelectItem>
                {availableMachines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency-filter">Frequency</Label>
            <Select
              value={filters.frequency}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  frequency: value,
                }))
              }
            >
              <SelectTrigger id="frequency-filter">
                <SelectValue placeholder="All frequencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All frequencies</SelectItem>
                {PM_FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option.toLowerCase()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  status: value,
                }))
              }
            >
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All status</SelectItem>
                {ANNUAL_PM_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status.toLowerCase()}>
                    {status}
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
                <SortableHeader<AnnualPmSortKey>
                  label="PM Plan Date"
                  sortKey="pmPlanDate"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <SortableHeader<AnnualPmSortKey>
                  label="Line"
                  sortKey="lineName"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <TableHead>Sub Line</TableHead>
                <SortableHeader<AnnualPmSortKey>
                  label="Machine Name"
                  sortKey="machineName"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <SortableHeader<AnnualPmSortKey>
                  label="Machine Code"
                  sortKey="machineCode"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <TableHead>Machine Type</TableHead>
                <TableHead>Frequency</TableHead>
                <SortableHeader<AnnualPmSortKey>
                  label="Status"
                  sortKey="status"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    {isFetching
                      ? "Loading report data..."
                      : "No maintenance records found for the selected filters."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((record, index) => (
                  <TableRow key={`${record.machineCode}-${record.pmPlanDate}-${index}`}>
                    <TableCell>{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                    <TableCell>{formatDateDisplay(record.pmPlanDate)}</TableCell>
                    <TableCell>{record.lineName ?? "-"}</TableCell>
                    <TableCell>{record.subLineName ?? "-"}</TableCell>
                    <TableCell>{record.machineName ?? "-"}</TableCell>
                    <TableCell>{record.machineCode ?? "-"}</TableCell>
                    <TableCell>{record.machineType ?? "-"}</TableCell>
                    <TableCell>{record.frequency ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] whitespace-pre-wrap text-sm">
                      {record.remarks ?? "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination className="pt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPage((prev) => Math.max(1, prev - 1));
                }}
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground px-4 py-2">
                Page {currentPage} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPage((prev) => Math.min(totalPages, prev + 1));
                }}
                aria-disabled={currentPage === totalPages}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Card>
    </ReportLayout>
  );
}function MonthlyPmReportView({ definition }: { definition: ReportDefinition }) {
  return (
    <MonthlyMaintenanceReportView definition={definition} config={MONTHLY_PM_REPORT_CONFIG} />
  );
}

function MonthlyPredictiveReportView({ definition }: { definition: ReportDefinition }) {
  return (
    <MonthlyMaintenanceReportView
      definition={definition}
      config={MONTHLY_PREDICTIVE_REPORT_CONFIG}
    />
  );
}

function MonthlyMaintenanceReportView({
  definition,
  config,
}: {
  definition: ReportDefinition;
  config: MonthlyMaintenanceReportConfig;
}) {
  const reportTitle = definition.title;
  const { queryKey, endpoint, defaultFilters, staticParams } = config;
  const { toast } = useToast();
  const [filters, setFilters] = useState<MonthlyPmFilters>(() => defaultFilters());
  const [sortConfig, setSortConfig] = useState<SortState<AnnualPmSortKey>>({
    key: "pmPlanDate",
    direction: "asc",
  });
  const [page, setPage] = useState(1);

  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/lines"] });
  const { data: subLines = [] } = useQuery<any[]>({ queryKey: ["/api/sub-lines"] });
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });

  const monthlyQuery = useQuery<AnnualPmReportRecord[]>({
    queryKey: [queryKey, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      const parsedYear = Number.parseInt(filters.year, 10);
      const safeYear = Number.isFinite(parsedYear) ? String(parsedYear) : String(new Date().getFullYear());
      params.set("year", safeYear);
      params.set("month", filters.month);
      if (!isAll(filters.lineId)) params.set("lineId", filters.lineId);
      if (!isAll(filters.subLineId)) params.set("subLineId", filters.subLineId);
      if (!isAll(filters.machineId)) params.set("machineId", filters.machineId);
      if (!isAll(filters.status)) params.set("status", filters.status);
      if (staticParams) {
        Object.entries(staticParams).forEach(([key, value]) => {
          if (value != null) {
            params.set(key, value);
          }
        });
      }

      const query = params.toString();
      const apiPath = query ? `${endpoint}?${query}` : endpoint;
      const response = await fetch(resolveApiUrl(apiPath), {
        credentials: "include",
      });
      if (!response.ok) {
        const message =
          (await response.text()) || response.statusText || `Failed to fetch ${reportTitle}`;
        throw new Error(message);
      }
      const payload = await response.json();
      return Array.isArray(payload?.data) ? payload.data : [];
    },
    refetchOnWindowFocus: false,
  });

  const reportData = monthlyQuery.data ?? [];
  const isFetching = monthlyQuery.isFetching;

  useEffect(() => {
    if (monthlyQuery.error instanceof Error) {
      toast({
        title: `Unable to load ${reportTitle}`,
        description: monthlyQuery.error.message,
        variant: "destructive",
      });
    }
  }, [monthlyQuery.error, toast, reportTitle]);

  const availableSubLines = useMemo(() => {
    if (isAll(filters.lineId)) {
      return [];
    }
    return subLines.filter((subLine) => subLine.lineId === filters.lineId);
  }, [filters.lineId, subLines]);

  const availableMachines = useMemo(() => {
    if (!isAll(filters.subLineId)) {
      return machines.filter((machine) => machine.subLineId === filters.subLineId);
    }
    if (!isAll(filters.lineId)) {
      return machines.filter((machine) => machine.lineId === filters.lineId);
    }
    return machines;
  }, [filters.lineId, filters.subLineId, machines]);

  useEffect(() => {
    setPage(1);
  }, [filters.year, filters.month, filters.lineId, filters.subLineId, filters.machineId, filters.status]);

  const handleSort = (key: AnnualPmSortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    const copy = [...reportData];
    copy.sort((a, b) => {
      const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
      const getString = (value: string | null | undefined) => (value ?? "").toLowerCase();

      let comparison = 0;
      switch (sortConfig.key) {
        case "pmPlanDate":
          comparison = getString(a.pmPlanDate).localeCompare(getString(b.pmPlanDate));
          break;
        case "lineName":
          comparison = getString(a.lineName).localeCompare(getString(b.lineName));
          break;
        case "machineName":
          comparison = getString(a.machineName).localeCompare(getString(b.machineName));
          break;
        case "machineCode":
          comparison = getString(a.machineCode).localeCompare(getString(b.machineCode));
          break;
        case "status":
          comparison = getString(a.status).localeCompare(getString(b.status));
          break;
        default:
          comparison = 0;
      }
      return comparison * directionMultiplier;
    });
    return copy;
  }, [reportData, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedData = sortedData.slice(pageStart, pageEnd);

  const handleExport = () => {
    if (!reportData.length) {
      toast({
        title: "No data to export",
        description: "Adjust the filters to include at least one maintenance schedule.",
        variant: "destructive",
      });
      return;
    }

    const rows = sortedData.map((record, index) => ({
      "S. No.": index + 1,
      "PM Plan Date": formatDateDisplay(record.pmPlanDate),
      Line: record.lineName ?? "-",
      "Sub Line": record.subLineName ?? "-",
      "Machine Name": record.machineName ?? "-",
      "Machine Code": record.machineCode ?? "-",
      "Machine Type": record.machineType ?? "-",
      Frequency: record.frequency ?? "-",
      Status: record.status ?? "-",
      Remarks: record.remarks ?? "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: ANNUAL_PM_HEADERS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reportTitle);
    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `${definition.slug}-report-${timestamp}.xlsx`);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters());
    setPage(1);
  };

  const displayYear = filters.year || String(new Date().getFullYear());
  const displayMonthLabel =
    MONTH_OPTIONS.find((option) => option.value === filters.month)?.label ?? "Select month";

  return (
    <ReportLayout
      definition={definition}
      onExport={handleExport}
      exportDisabled={!reportData.length || isFetching}
    >
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filters</h2>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthly-year-input">Year</Label>
            <Input
              id="monthly-year-input"
              type="number"
              min={2000}
              max={9999}
              value={displayYear}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  year: event.target.value.replace(/[^0-9]/g, "").slice(0, 4),
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="month-filter">Month</Label>
            <Select
              value={filters.month}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, month: value }))}
            >
              <SelectTrigger id="month-filter">
                <SelectValue placeholder="Select month">{displayMonthLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly-line-filter">Line</Label>
            <Select
              value={filters.lineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  lineId: value,
                  subLineId: ALL_OPTION,
                  machineId: ALL_OPTION,
                }))
              }
            >
              <SelectTrigger id="monthly-line-filter">
                <SelectValue placeholder="All lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All lines</SelectItem>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly-subline-filter">Sub Line</Label>
            <Select
              value={filters.subLineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  subLineId: value,
                  machineId: ALL_OPTION,
                }))
              }
              disabled={isAll(filters.lineId) || availableSubLines.length === 0}
            >
              <SelectTrigger id="monthly-subline-filter">
                <SelectValue
                  placeholder={isAll(filters.lineId) ? "Select a line first" : "All sub lines"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All sub lines</SelectItem>
                {availableSubLines.map((subLine) => (
                  <SelectItem key={subLine.id} value={subLine.id}>
                    {subLine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly-machine-filter">Machine</Label>
            <Select
              value={filters.machineId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  machineId: value,
                }))
              }
              disabled={availableMachines.length === 0}
            >
              <SelectTrigger id="monthly-machine-filter">
                <SelectValue placeholder="All machines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All machines</SelectItem>
                {availableMachines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly-status-filter">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  status: value,
                }))
              }
            >
              <SelectTrigger id="monthly-status-filter">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All status</SelectItem>
                {ANNUAL_PM_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status.toLowerCase()}>
                    {status}
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
                <SortableHeader<AnnualPmSortKey>
                  label="PM Plan Date"
                  sortKey="pmPlanDate"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <SortableHeader<AnnualPmSortKey>
                  label="Line"
                  sortKey="lineName"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <TableHead>Sub Line</TableHead>
                <SortableHeader<AnnualPmSortKey>
                  label="Machine Name"
                  sortKey="machineName"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <SortableHeader<AnnualPmSortKey>
                  label="Machine Code"
                  sortKey="machineCode"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <TableHead>Machine Type</TableHead>
                <TableHead>Frequency</TableHead>
                <SortableHeader<AnnualPmSortKey>
                  label="Status"
                  sortKey="status"
                  onSort={handleSort}
                  sortConfig={sortConfig}
                />
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    {isFetching
                      ? "Loading report data..."
                      : "No maintenance records found for the selected filters."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((record, index) => (
                  <TableRow key={`${record.machineCode}-${record.pmPlanDate}-${index}`}>
                    <TableCell>{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                    <TableCell>{formatDateDisplay(record.pmPlanDate)}</TableCell>
                    <TableCell>{record.lineName ?? "-"}</TableCell>
                    <TableCell>{record.subLineName ?? "-"}</TableCell>
                    <TableCell>{record.machineName ?? "-"}</TableCell>
                    <TableCell>{record.machineCode ?? "-"}</TableCell>
                    <TableCell>{record.machineType ?? "-"}</TableCell>
                    <TableCell>{record.frequency ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] whitespace-pre-wrap text-sm">
                      {record.remarks ?? "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination className="pt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPage((prev) => Math.max(1, prev - 1));
                }}
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground px-4 py-2">
                Page {currentPage} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setPage((prev) => Math.min(totalPages, prev + 1));
                }}
                aria-disabled={currentPage === totalPages}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Card>
    </ReportLayout>
  );
}function ReportPlaceholder({ definition }: { definition: ReportDefinition }) {
  return (
    <ReportLayout definition={definition} exportDisabled>
      <Card className="p-6 space-y-4">
        <div className="flex gap-3 text-muted-foreground">
          <Info className="h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <p>
              {definition.title} is being implemented. The filters, data table, and Excel export workflow will
              appear here once the underlying API is delivered.
            </p>
            <p className="text-sm">
              Use the navigation menu to explore other available reports in the meantime.
            </p>
          </div>
        </div>
      </Card>
    </ReportLayout>
  );
}

interface ReportLayoutProps {
  definition: ReportDefinition;
  children: ReactNode;
  onExport?: () => void;
  exportDisabled?: boolean;
}

function ReportLayout({ definition, children, onExport, exportDisabled }: ReportLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{definition.title}</h1>
          <p className="text-sm text-muted-foreground">{definition.description}</p>
        </div>
        <Button
          onClick={onExport}
          disabled={exportDisabled || !onExport}
          data-testid={`button-export-${definition.slug}`}
        >
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>
      {children}
    </div>
  );
}

interface SortableHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  sortConfig: SortState<K>;
  onSort: (key: K) => void;
}

function SortableHeader<K extends string>({ label, sortKey, sortConfig, onSort }: SortableHeaderProps<K>) {
  const isActive = sortConfig.key === sortKey;
  const directionLabel = isActive ? (sortConfig.direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
      >
        {label}
        <ArrowUpDown
          className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
          aria-label={`Sort ${directionLabel}`}
        />
      </button>
    </TableHead>
  );
}


