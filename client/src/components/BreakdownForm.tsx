import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

const MASTER_DATA = {
  lines: [
    "FRONT LINE",
    "FT & MANIFOLD  LINE",
    "IMM & PRESS SHOP"
  ],
  sub_lines: [
    "AC LINE",
    "CAB LINE",
    "CAC LINE",
    "CONDENCER LINE",
    "ECM LINE",
    "GAMA LINE",
    "HEADER PRESS",
    "IMM",
    "RADIATOR LINE"
  ],
  machines: [
    "CORE BUILDER -5 MATRIX (RAD)",
    "CORE BUILDER-1 (CAC)",
    "CORE BUILDER-1 MATRIX (COND)",
    "CORE BUILDER-1 MATRIX GAMMA (CAC)",
    "CORE BUILDER-2 MATRIX (COND)",
    "CORE BUILDER-2 MATRIX GAMMA (CAC)",
    "CORE BUILDER-4 MATRIX (COND)",
    "CORE BUILDER-6 MATRIX (RAD)",
    "DRY LEAK TEST & PRINTER (GAMMA )",
    "FAN BALANCING-1 (ECM-A)",
    "FIN MILL -2",
    "FIN MILL- 5 (MATRIX)",
    "FIN MILL-10 (AUTO FIN INSERTION)",
    "FIN MILL-8 (MATRIX)",
    "HEADER PRESS-2",
    "HELIUM LEAK DETECTOR-2 (MSIL)",
    "MOULDING -1",
    "PIPE ASSY-2 (GAMMA)",
    "PRESSURE SWITCH ASSEMBLY",
    "WLT- AC LINE"
  ],
  priorities: ["High", "Medium", "Low"],
  problem_types: [
    "B/D",
    "SAFETY /OTHER"
  ],
  attendees: [
    "ADITYA",
    "AKHIL",
    "ANUBHAV",
    "ASHUTOSH TRPATHI",
    "ASLAM KHAN",
    "DALIP KUMAR",
    "DINESH TYAGI",
    "MUKESH SHARMA",
    "NARENDER KUMAR",
    "RADHE SHAYM",
    "SANTOSH SHARMA",
    "SATYA PRAKASH"
  ],
  closers: [
    "AKHIL",
    "ASHUTOSH TIRPATHI",
    "ASLAM KHAN",
    "BALAM  DAS",
    "HARSH",
    "NARENDER KUMAR",
    "RADHAY SHYAM",
    "Santosh Sharma",
    "Satya Prakash"
  ],
  shifts: ["A", "B", "C"]
};

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
    priority: '',
    actionTaken: '',
    rootCause: '',
    startTime: '',
    finishTime: '',
    totalTime: '',
    majorContribution: '',
    majorContributionTime: '',
    attendBy: '',
    closedBy: '',
    remark: ''
  });

  const calculateTotalTime = () => {
    if (formData.startTime && formData.finishTime) {
      const start = new Date(`2000-01-01T${formData.startTime}`);
      const finish = new Date(`2000-01-01T${formData.finishTime}`);
      const diffMs = finish.getTime() - start.getTime();
      const diffMins = Math.round(diffMs / 60000);
      setFormData({ ...formData, totalTime: diffMins.toString() });
    }
  };

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
                {MASTER_DATA.shifts.map((shift) => (
                  <SelectItem key={shift} value={shift}>Shift {shift}</SelectItem>
                ))}
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
                {MASTER_DATA.lines.map((line) => (
                  <SelectItem key={line} value={line}>{line}</SelectItem>
                ))}
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
                {MASTER_DATA.sub_lines.map((subLine) => (
                  <SelectItem key={subLine} value={subLine}>{subLine}</SelectItem>
                ))}
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
                {MASTER_DATA.machines.map((machine) => (
                  <SelectItem key={machine} value={machine}>{machine}</SelectItem>
                ))}
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
                {MASTER_DATA.problem_types.map((problem) => (
                  <SelectItem key={problem} value={problem}>{problem}</SelectItem>
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
                {MASTER_DATA.priorities.map((priority) => (
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
              onChange={(e) => {
                setFormData({ ...formData, startTime: e.target.value });
                setTimeout(calculateTotalTime, 100);
              }}
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
              onChange={(e) => {
                setFormData({ ...formData, finishTime: e.target.value });
                setTimeout(calculateTotalTime, 100);
              }}
              data-testid="input-finish-time"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalTime">Total Time (minutes)</Label>
            <Input
              id="totalTime"
              type="text"
              value={formData.totalTime}
              disabled
              className="bg-muted"
              data-testid="input-total-time"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="majorContribution">Major Contribution in BD</Label>
            <Input
              id="majorContribution"
              type="text"
              value={formData.majorContribution}
              onChange={(e) => setFormData({ ...formData, majorContribution: e.target.value })}
              placeholder="Describe major contribution"
              data-testid="input-major-contribution"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="majorContributionTime">Major Contribution Time (minutes)</Label>
            <Input
              id="majorContributionTime"
              type="number"
              value={formData.majorContributionTime}
              onChange={(e) => setFormData({ ...formData, majorContributionTime: e.target.value })}
              placeholder="Time in minutes"
              data-testid="input-major-contribution-time"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendBy">Attended By <span className="text-destructive">*</span></Label>
            <Select value={formData.attendBy} onValueChange={(value) => setFormData({ ...formData, attendBy: value })}>
              <SelectTrigger id="attendBy" data-testid="select-attend-by">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {MASTER_DATA.attendees.map((attendee) => (
                  <SelectItem key={attendee} value={attendee}>{attendee}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closedBy">Closed By</Label>
            <Select value={formData.closedBy} onValueChange={(value) => setFormData({ ...formData, closedBy: value })}>
              <SelectTrigger id="closedBy" data-testid="select-closed-by">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {MASTER_DATA.closers.map((closer) => (
                  <SelectItem key={closer} value={closer}>{closer}</SelectItem>
                ))}
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
