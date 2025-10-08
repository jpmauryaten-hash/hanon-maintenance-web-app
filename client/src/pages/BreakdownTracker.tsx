import { useState } from "react";
import BreakdownForm from "@/components/BreakdownForm";
import BreakdownTable from "@/components/BreakdownTable";
import { Button } from "@/components/ui/button";
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

export default function BreakdownTracker() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBreakdown, setEditingBreakdown] = useState<any>(null);
  const [viewingBreakdown, setViewingBreakdown] = useState<any>(null);
  const { toast } = useToast();

  const { data: breakdowns = [] } = useQuery<any[]>({
    queryKey: ["/api/breakdowns"],
  });

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

      <BreakdownTable 
        breakdowns={breakdowns}
        canEdit={true}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog open={isFormOpen || !!editingBreakdown} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBreakdown ? 'Edit Breakdown Entry' : 'New Breakdown Entry'}</DialogTitle>
          </DialogHeader>
          <BreakdownForm 
            onSubmit={handleSubmit}
            onCancel={handleCloseDialog}
            initialData={editingBreakdown}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingBreakdown} onOpenChange={handleCloseViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

  const isCapaRequired = breakdown.priority === 'High' && parseInt(breakdown.totalMinutes || '0') >= 45;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Date</label>
          <p className="font-mono">{breakdown.date}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Shift</label>
          <p>{breakdown.shift}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Priority</label>
          <p>{breakdown.priority}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Line</label>
          <p>{line}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Sub Line</label>
          <p>{subLine || '-'}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Machine</label>
          <p>{machine}</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-muted-foreground">Problem Type</label>
        <p>{problemType}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Start Time</label>
          <p className="font-mono">{breakdown.startTime}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Finish Time</label>
          <p className="font-mono">{breakdown.finishTime || '-'}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Total Minutes</label>
          <p className="font-mono">{breakdown.totalMinutes || '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Action Taken</label>
          <p>{breakdown.actionTaken || '-'}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Root Cause</label>
          <p>{breakdown.rootCause || '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Major Contribution</label>
          <p>{breakdown.majorContribution || '-'}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Major Contribution Time (min)</label>
          <p className="font-mono">{breakdown.majorContributionTime || '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Attended By</label>
          <p>{attendBy}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Status</label>
          <p>{breakdown.status}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Closed By</label>
          <p>{closedBy || '-'}</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-muted-foreground">Remark</label>
        <p>{breakdown.remark || '-'}</p>
      </div>

      {isCapaRequired && (
        <>
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">CAPA Sheet - Five Why Analysis</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Operator</label>
              <p>{breakdown.capaOperator || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Maintenance</label>
              <p>{breakdown.capaMaintenance || '-'}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-muted-foreground">What Happened</label>
            <p>{breakdown.capaWhatHappened || '-'}</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-muted-foreground">Failure Mode</label>
            <p>{breakdown.capaFailureMode || '-'}</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-muted-foreground">Sketch</label>
            <p>{breakdown.capaSketch || '-'}</p>
          </div>

          {problemDescriptions.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Problem Descriptions (Five Whys)</label>
              {problemDescriptions.map((problem: any, index: number) => (
                <div key={index} className="mt-4 p-4 border rounded-md">
                  <p className="font-semibold mb-2">Problem {index + 1}</p>
                  <p className="text-sm mb-2">{problem.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {problem.why1 && <div><span className="font-semibold">Why 1:</span> {problem.why1}</div>}
                    {problem.why2 && <div><span className="font-semibold">Why 2:</span> {problem.why2}</div>}
                    {problem.why3 && <div><span className="font-semibold">Why 3:</span> {problem.why3}</div>}
                    {problem.why4 && <div><span className="font-semibold">Why 4:</span> {problem.why4}</div>}
                    {problem.why5 && <div><span className="font-semibold">Why 5:</span> {problem.why5}</div>}
                  </div>
                  {problem.category && <p className="text-sm mt-2"><span className="font-semibold">Category:</span> {problem.category}</p>}
                  {problem.correctiveAction && <p className="text-sm mt-2"><span className="font-semibold">Corrective Action:</span> {problem.correctiveAction}</p>}
                  {problem.preventiveAction && <p className="text-sm mt-2"><span className="font-semibold">Preventive Action:</span> {problem.preventiveAction}</p>}
                </div>
              ))}
            </div>
          )}

          {rootCauses.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Root Causes & Countermeasures</label>
              {rootCauses.map((rc: any, index: number) => (
                <div key={index} className="mt-2 p-4 border rounded-md text-sm">
                  <p><span className="font-semibold">Root Cause:</span> {rc.rootCause}</p>
                  <p><span className="font-semibold">Category:</span> {rc.category}</p>
                  <p><span className="font-semibold">Countermeasures:</span> {rc.countermeasures}</p>
                </div>
              ))}
            </div>
          )}

          {preventiveActions.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Preventive Action Plan</label>
              {preventiveActions.map((pa: any, index: number) => (
                <div key={index} className="mt-2 p-4 border rounded-md text-sm">
                  <p><span className="font-semibold">Description:</span> {pa.description}</p>
                  <p><span className="font-semibold">By Whom:</span> {pa.byWhom}</p>
                  <p><span className="font-semibold">Action:</span> {pa.action}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Prepared By</label>
              <p>{breakdown.capaPreparedBy || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Checked By</label>
              <p>{breakdown.capaCheckedBy || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Reviewed By</label>
              <p>{breakdown.capaReviewedBy || '-'}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
