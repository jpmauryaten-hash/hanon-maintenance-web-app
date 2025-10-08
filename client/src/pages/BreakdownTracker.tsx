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
              <td className="p-3">{breakdown.priority}</td>
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
            <tr>
              <td className="font-semibold p-3 bg-muted/50">Remark</td>
              <td className="p-3" colSpan={3}>{breakdown.remark || '-'}</td>
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
