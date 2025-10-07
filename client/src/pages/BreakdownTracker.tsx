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

  const handleSubmit = (data: any) => {
    createMutation.mutate(data);
  };

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

  const handleEdit = (id: number) => {
    console.log('Edit breakdown:', id);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id.toString());
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Breakdown Entry</DialogTitle>
          </DialogHeader>
          <BreakdownForm 
            onSubmit={handleSubmit}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
