import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

interface BreakdownFormProps {
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
  initialData?: any;
}

export default function BreakdownForm({ onSubmit, onCancel, initialData }: BreakdownFormProps) {
  const [formData, setFormData] = useState(initialData || {
    date: '',
    shift: '',
    line: '',
    subLine: '',
    machine: '',
    problem: '',
    actionTaken: '',
    rootCause: '',
    startTime: '',
    finishTime: '',
    attendBy: '',
    remark: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    onSubmit?.(formData);
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
                <SelectItem value="A">Shift A</SelectItem>
                <SelectItem value="B">Shift B</SelectItem>
                <SelectItem value="C">Shift C</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="line">Line <span className="text-destructive">*</span></Label>
            <Select value={formData.line} onValueChange={(value) => setFormData({ ...formData, line: value })}>
              <SelectTrigger id="line" data-testid="select-line">
                <SelectValue placeholder="Select line" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line1">Line 1</SelectItem>
                <SelectItem value="line2">Line 2</SelectItem>
                <SelectItem value="line3">Line 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subLine">Sub Line</Label>
            <Select value={formData.subLine} onValueChange={(value) => setFormData({ ...formData, subLine: value })}>
              <SelectTrigger id="subLine" data-testid="select-subline">
                <SelectValue placeholder="Select sub line" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subline1">Sub Line 1A</SelectItem>
                <SelectItem value="subline2">Sub Line 1B</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="machine">Machine <span className="text-destructive">*</span></Label>
            <Select value={formData.machine} onValueChange={(value) => setFormData({ ...formData, machine: value })}>
              <SelectTrigger id="machine" data-testid="select-machine">
                <SelectValue placeholder="Select machine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cnc101">CNC-101</SelectItem>
                <SelectItem value="lathe205">LATHE-205</SelectItem>
                <SelectItem value="mill330">MILL-330</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="problem">Problem Type <span className="text-destructive">*</span></Label>
            <Select value={formData.problem} onValueChange={(value) => setFormData({ ...formData, problem: value })}>
              <SelectTrigger id="problem" data-testid="select-problem">
                <SelectValue placeholder="Select problem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="motor">Motor Failure</SelectItem>
                <SelectItem value="belt">Belt Broken</SelectItem>
                <SelectItem value="electrical">Electrical Issue</SelectItem>
                <SelectItem value="mechanical">Mechanical Issue</SelectItem>
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
              data-testid="input-start-time"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="finishTime">Finish Time</Label>
            <Input
              id="finishTime"
              type="time"
              value={formData.finishTime}
              onChange={(e) => setFormData({ ...formData, finishTime: e.target.value })}
              data-testid="input-finish-time"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendBy">Attended By <span className="text-destructive">*</span></Label>
            <Select value={formData.attendBy} onValueChange={(value) => setFormData({ ...formData, attendBy: value })}>
              <SelectTrigger id="attendBy" data-testid="select-attend-by">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="emp1">John Doe</SelectItem>
                <SelectItem value="emp2">Jane Smith</SelectItem>
                <SelectItem value="emp3">Mike Johnson</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="actionTaken">Action Taken</Label>
            <Textarea
              id="actionTaken"
              value={formData.actionTaken}
              onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
              placeholder="Describe the action taken to resolve the issue"
              rows={3}
              data-testid="textarea-action-taken"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="rootCause">Root Cause</Label>
            <Textarea
              id="rootCause"
              value={formData.rootCause}
              onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
              placeholder="Identify the root cause of the breakdown"
              rows={3}
              data-testid="textarea-root-cause"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="remark">Remark</Label>
            <Textarea
              id="remark"
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              placeholder="Additional remarks or notes"
              rows={2}
              data-testid="textarea-remark"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
              Cancel
            </Button>
          )}
          <Button type="submit" data-testid="button-submit">
            Submit Breakdown Entry
          </Button>
        </div>
      </form>
    </Card>
  );
}
