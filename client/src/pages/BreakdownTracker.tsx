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
    </div>
  );
}
