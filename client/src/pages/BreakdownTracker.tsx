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

const mockBreakdowns = [
  {
    id: 1,
    date: '2025-10-07',
    shift: 'A',
    line: 'Line 1',
    machine: 'CNC-101',
    problem: 'Motor failure',
    status: 'open' as const,
    totalMinutes: 120,
    attendBy: 'John Doe'
  },
  {
    id: 2,
    date: '2025-10-07',
    shift: 'B',
    line: 'Line 2',
    machine: 'LATHE-205',
    problem: 'Belt broken',
    status: 'closed' as const,
    totalMinutes: 45,
    attendBy: 'Jane Smith'
  }
];

export default function BreakdownTracker() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [breakdowns, setBreakdowns] = useState(mockBreakdowns);

  const handleSubmit = (data: any) => {
    console.log('New breakdown:', data);
    setIsFormOpen(false);
  };

  const handleEdit = (id: number) => {
    console.log('Edit breakdown:', id);
  };

  const handleDelete = (id: number) => {
    console.log('Delete breakdown:', id);
    setBreakdowns(breakdowns.filter(b => b.id !== id));
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
