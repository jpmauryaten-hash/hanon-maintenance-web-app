import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

const SHIFTS = ["A", "B", "C"];
const PRIORITIES = ["High", "Medium", "Low"];

interface BreakdownFormProps {
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
  initialData?: any;
}

export default function BreakdownForm({ onSubmit, onCancel, initialData }: BreakdownFormProps) {
  const [formData, setFormData] = useState(initialData || {
    date: '',
    shift: '',
    lineId: '',
    subLineId: '',
    machineId: '',
    problemTypeId: '',
    priority: '',
    actionTaken: '',
    rootCause: '',
    startTime: '',
    finishTime: '',
    totalMinutes: '',
    majorContribution: '',
    majorContributionTime: '',
    attendById: '',
    closedById: '',
    remark: '',
    status: 'open'
  });

  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/lines"] });
  const { data: subLines = [] } = useQuery<any[]>({ queryKey: ["/api/sub-lines"] });
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });
  const { data: problemTypes = [] } = useQuery<any[]>({ queryKey: ["/api/problem-types"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const calculateTotalTime = () => {
    if (formData.startTime && formData.finishTime) {
      const start = new Date(`2000-01-01T${formData.startTime}`);
      const finish = new Date(`2000-01-01T${formData.finishTime}`);
      const diffMs = finish.getTime() - start.getTime();
      const diffMins = Math.round(diffMs / 60000);
      setFormData({ ...formData, totalMinutes: diffMins });
    }
  };

  useEffect(() => {
    calculateTotalTime();
  }, [formData.startTime, formData.finishTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      totalMinutes: formData.totalMinutes ? parseInt(formData.totalMinutes) : null,
      majorContributionTime: formData.majorContributionTime ? parseInt(formData.majorContributionTime) : null,
      subLineId: formData.subLineId || null,
      closedById: formData.closedById || null,
    };
    
    onSubmit?.(submitData);
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="date">Date <span className="text-destructive">*</span></Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              data-testid="input-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shift">Shift <span className="text-destructive">*</span></Label>
            <Select value={formData.shift} onValueChange={(value) => setFormData({ ...formData, shift: value })}>
              <SelectTrigger id="shift" data-testid="select-shift">
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((shift) => (
                  <SelectItem key={shift} value={shift}>Shift {shift}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="line">Line <span className="text-destructive">*</span></Label>
            <Select value={formData.lineId} onValueChange={(value) => setFormData({ ...formData, lineId: value })}>
              <SelectTrigger id="line" data-testid="select-line">
                <SelectValue placeholder="Select line" />
              </SelectTrigger>
              <SelectContent>
                {lines.map((line: any) => (
                  <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subLine">Sub Line</Label>
            <Select value={formData.subLineId} onValueChange={(value) => setFormData({ ...formData, subLineId: value })}>
              <SelectTrigger id="subLine" data-testid="select-subline">
                <SelectValue placeholder="Select sub line" />
              </SelectTrigger>
              <SelectContent>
                {subLines.map((subLine: any) => (
                  <SelectItem key={subLine.id} value={subLine.id}>{subLine.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="machine">Machine <span className="text-destructive">*</span></Label>
            <Select value={formData.machineId} onValueChange={(value) => setFormData({ ...formData, machineId: value })}>
              <SelectTrigger id="machine" data-testid="select-machine">
                <SelectValue placeholder="Select machine" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((machine: any) => (
                  <SelectItem key={machine.id} value={machine.id}>{machine.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="problem">Problem Type <span className="text-destructive">*</span></Label>
            <Select value={formData.problemTypeId} onValueChange={(value) => setFormData({ ...formData, problemTypeId: value })}>
              <SelectTrigger id="problem" data-testid="select-problem">
                <SelectValue placeholder="Select problem" />
              </SelectTrigger>
              <SelectContent>
                {problemTypes.map((problem: any) => (
                  <SelectItem key={problem.id} value={problem.id}>{problem.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority <span className="text-destructive">*</span></Label>
            <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
              <SelectTrigger id="priority" data-testid="select-priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startTime">Start Time <span className="text-destructive">*</span></Label>
            <Input
              id="startTime"
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              required
              data-testid="input-starttime"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="finishTime">Finish Time</Label>
            <Input
              id="finishTime"
              type="time"
              value={formData.finishTime}
              onChange={(e) => setFormData({ ...formData, finishTime: e.target.value })}
              data-testid="input-finishtime"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalMinutes">Total Time (minutes)</Label>
            <Input
              id="totalMinutes"
              type="number"
              value={formData.totalMinutes}
              onChange={(e) => setFormData({ ...formData, totalMinutes: e.target.value })}
              placeholder="Auto-calculated"
              data-testid="input-totaltime"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendBy">Attend By <span className="text-destructive">*</span></Label>
            <Select value={formData.attendById} onValueChange={(value) => setFormData({ ...formData, attendById: value })}>
              <SelectTrigger id="attendBy" data-testid="select-attendby">
                <SelectValue placeholder="Select attendee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee: any) => (
                  <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closedBy">Closed By</Label>
            <Select value={formData.closedById} onValueChange={(value) => setFormData({ ...formData, closedById: value })}>
              <SelectTrigger id="closedBy" data-testid="select-closedby">
                <SelectValue placeholder="Select closer" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee: any) => (
                  <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="actionTaken">Action Taken</Label>
          <Textarea
            id="actionTaken"
            value={formData.actionTaken}
            onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
            placeholder="Describe the action taken"
            rows={3}
            data-testid="textarea-actiontaken"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rootCause">Root Cause</Label>
          <Textarea
            id="rootCause"
            value={formData.rootCause}
            onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
            placeholder="Describe the root cause"
            rows={3}
            data-testid="textarea-rootcause"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="majorContribution">Major Contribution</Label>
          <Textarea
            id="majorContribution"
            value={formData.majorContribution}
            onChange={(e) => setFormData({ ...formData, majorContribution: e.target.value })}
            placeholder="Describe major contribution"
            rows={2}
            data-testid="textarea-majorcontribution"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="majorContributionTime">Major Contribution Time (minutes)</Label>
          <Input
            id="majorContributionTime"
            type="number"
            value={formData.majorContributionTime}
            onChange={(e) => setFormData({ ...formData, majorContributionTime: e.target.value })}
            placeholder="Enter time in minutes"
            data-testid="input-majorcontributiontime"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="remark">Remark</Label>
          <Textarea
            id="remark"
            value={formData.remark}
            onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
            placeholder="Additional remarks"
            rows={2}
            data-testid="textarea-remark"
          />
        </div>

        <div className="flex gap-4 justify-end">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
              Cancel
            </Button>
          )}
          <Button type="submit" data-testid="button-submit">
            Submit
          </Button>
        </div>
      </form>
    </Card>
  );
}
