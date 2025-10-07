import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import BreakdownStatusBadge from "./BreakdownStatusBadge";

interface Breakdown {
  id: number;
  date: string;
  shift: string;
  line: string;
  machine: string;
  problem: string;
  status: "open" | "closed" | "pending";
  totalMinutes: number;
  attendBy: string;
}

interface BreakdownTableProps {
  breakdowns: Breakdown[];
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  canEdit?: boolean;
}

export default function BreakdownTable({ 
  breakdowns, 
  onEdit, 
  onDelete,
  canEdit = false 
}: BreakdownTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Shift</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Line</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Machine</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Problem</TableHead>
            <TableHead className="text-xs font-semibold uppercase text-right">Downtime (min)</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Attended By</TableHead>
            <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
            {canEdit && <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {breakdowns.map((breakdown, index) => (
            <TableRow 
              key={breakdown.id} 
              className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
              data-testid={`row-breakdown-${breakdown.id}`}
            >
              <TableCell className="font-mono text-sm">{breakdown.date}</TableCell>
              <TableCell>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  breakdown.shift === 'A' ? 'bg-primary/10 text-primary' :
                  breakdown.shift === 'B' ? 'bg-warning/10 text-warning' :
                  'bg-success/10 text-success'
                }`}>
                  {breakdown.shift}
                </span>
              </TableCell>
              <TableCell>{breakdown.line}</TableCell>
              <TableCell className="font-medium">{breakdown.machine}</TableCell>
              <TableCell>{breakdown.problem}</TableCell>
              <TableCell className="text-right font-mono">{breakdown.totalMinutes}</TableCell>
              <TableCell>{breakdown.attendBy}</TableCell>
              <TableCell>
                <BreakdownStatusBadge status={breakdown.status} />
              </TableCell>
              {canEdit && (
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit?.(breakdown.id)}
                      data-testid={`button-edit-${breakdown.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete?.(breakdown.id)}
                      data-testid={`button-delete-${breakdown.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
