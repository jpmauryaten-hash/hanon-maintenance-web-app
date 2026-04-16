import { useEffect, useMemo, useState } from "react";
import BreakdownTable from "@/components/BreakdownTable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const PAGE_SIZE = 15;

export default function DeletedBreakdowns() {
  const { user } = useAuth();
  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const { toast } = useToast();
  const [page, setPage] = useState(1);

  const { data: response, isFetching } = useQuery<any>({
    queryKey: ["/api/breakdowns/deleted", page, PAGE_SIZE],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await apiRequest("GET", `/api/breakdowns/deleted?${params.toString()}`);
      return res.json();
    },
    enabled: isAdmin,
    keepPreviousData: true,
  });

  const breakdowns = useMemo(() => response?.items ?? [], [response]);
  const meta = response?.meta ?? null;
  const totalPages = meta?.totalPages ? Math.max(1, meta.totalPages) : 1;
  const totalItems = meta?.total ?? breakdowns.length;
  const startEntry = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endEntry = totalItems === 0 ? 0 : Math.min(totalItems, page * PAGE_SIZE);

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

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/breakdowns/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breakdowns/deleted"] });
      queryClient.invalidateQueries({ queryKey: ["/api/breakdowns"] });
      toast({
        title: "Restored",
        description: "Breakdown entry restored successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restore breakdown entry",
        variant: "destructive",
      });
    },
  });

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Deleted Breakdowns</h1>
        <Card className="p-6 text-sm text-muted-foreground">
          You do not have permission to view deleted breakdowns.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deleted Breakdowns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Restore deleted breakdown entries.
          </p>
        </div>
      </div>

      <BreakdownTable
        breakdowns={breakdowns}
        onRestore={(id) => restoreMutation.mutate(id)}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {isFetching
            ? "Loading deleted breakdowns..."
            : totalItems > 0
              ? `Showing ${startEntry}-${endEntry} of ${totalItems}`
              : "No deleted breakdowns found."}
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
    </div>
  );
}
