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
const STATUSES = ["open", "closed", "pending"];

interface BreakdownFormProps {
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
  initialData?: any;
}

const CATEGORIES = [
  "1. Design faults",
  "2. Lack of preventive maint.",
  "3. Previous quick fix",
  "4. Incorrect prod. operation",
  "5. Spare part quality/availability",
  "6. Lack of AM",
  "7. Improvement or modification untested",
  "8. Lack of CBM",
  "9. Part life span not predicted"
];

export default function BreakdownForm({ onSubmit, onCancel, initialData }: BreakdownFormProps) {
  const [formData, setFormData] = useState({
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
    status: 'open',
    // CAPA fields
    capaOperator: '',
    capaMaintenance: '',
    capaWhatHappened: '',
    capaFailureMode: '',
    capaSketch: '',
    capaProblemDescription: '',
    capaWhy1: '',
    capaWhy1Check: '',
    capaWhy2: '',
    capaWhy2Check: '',
    capaWhy3: '',
    capaWhy3Check: '',
    capaWhy4: '',
    capaWhy4Check: '',
    capaWhy5: '',
    capaWhy5Check: '',
    capa4M: '',
    capaCorrectiveAction: '',
    capaPreventiveAction: '',
    capaCountermeasures: '',
    capaEvidenceBefore: '',
    capaEvidenceAfter: '',
    capaPreparedBy: '',
    capaCheckedBy: '',
    capaReviewedBy: ''
  });

  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/lines"] });
  const { data: subLines = [] } = useQuery<any[]>({ queryKey: ["/api/sub-lines"] });
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });
  const { data: problemTypes = [] } = useQuery<any[]>({ queryKey: ["/api/problem-types"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  useEffect(() => {
    if (initialData) {
      setFormData({
        date: initialData.date || '',
        shift: initialData.shift || '',
        lineId: initialData.lineId || '',
        subLineId: initialData.subLineId || '',
        machineId: initialData.machineId || '',
        problemTypeId: initialData.problemTypeId || '',
        priority: initialData.priority || '',
        actionTaken: initialData.actionTaken || '',
        rootCause: initialData.rootCause || '',
        startTime: initialData.startTime || '',
        finishTime: initialData.finishTime || '',
        totalMinutes: initialData.totalMinutes || '',
        majorContribution: initialData.majorContribution || '',
        majorContributionTime: initialData.majorContributionTime || '',
        attendById: initialData.attendById || '',
        closedById: initialData.closedById || '',
        remark: initialData.remark || '',
        status: initialData.status || 'open',
        capaOperator: initialData.capaOperator || '',
        capaMaintenance: initialData.capaMaintenance || '',
        capaWhatHappened: initialData.capaWhatHappened || '',
        capaFailureMode: initialData.capaFailureMode || '',
        capaSketch: initialData.capaSketch || '',
        capaProblemDescription: initialData.capaProblemDescription || '',
        capaWhy1: initialData.capaWhy1 || '',
        capaWhy1Check: initialData.capaWhy1Check || '',
        capaWhy2: initialData.capaWhy2 || '',
        capaWhy2Check: initialData.capaWhy2Check || '',
        capaWhy3: initialData.capaWhy3 || '',
        capaWhy3Check: initialData.capaWhy3Check || '',
        capaWhy4: initialData.capaWhy4 || '',
        capaWhy4Check: initialData.capaWhy4Check || '',
        capaWhy5: initialData.capaWhy5 || '',
        capaWhy5Check: initialData.capaWhy5Check || '',
        capa4M: initialData.capa4M || '',
        capaCorrectiveAction: initialData.capaCorrectiveAction || '',
        capaPreventiveAction: initialData.capaPreventiveAction || '',
        capaCountermeasures: initialData.capaCountermeasures || '',
        capaEvidenceBefore: initialData.capaEvidenceBefore || '',
        capaEvidenceAfter: initialData.capaEvidenceAfter || '',
        capaPreparedBy: initialData.capaPreparedBy || '',
        capaCheckedBy: initialData.capaCheckedBy || '',
        capaReviewedBy: initialData.capaReviewedBy || ''
      });
    }
  }, [initialData]);

  const calculateTotalTime = () => {
    if (formData.startTime && formData.finishTime) {
      const start = new Date(`2000-01-01T${formData.startTime}`);
      const finish = new Date(`2000-01-01T${formData.finishTime}`);
      const diffMs = finish.getTime() - start.getTime();
      const diffMins = Math.round(diffMs / 60000);
      setFormData({ ...formData, totalMinutes: diffMins.toString() });
    }
  };

  useEffect(() => {
    calculateTotalTime();
  }, [formData.startTime, formData.finishTime]);

  const isCapaRequired = formData.priority === 'High' && parseInt(formData.totalMinutes || '0') >= 45;

  const isCapaComplete = () => {
    if (!isCapaRequired) return true;
    return !!(
      formData.capaWhy1 &&
      formData.capaCorrectiveAction &&
      formData.capaPreventiveAction &&
      formData.capaPreparedBy
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.status === 'closed' && isCapaRequired && !isCapaComplete()) {
      alert('CAPA sheet must be completed before closing this breakdown (Priority: High, Time: ≥45 min)');
      return;
    }

    const submitData = {
      ...formData,
      totalMinutes: formData.totalMinutes ? parseInt(formData.totalMinutes) : null,
      majorContributionTime: formData.majorContributionTime ? parseInt(formData.majorContributionTime) : null,
      subLineId: formData.subLineId || null,
      closedById: formData.closedById || null,
      capaRequired: isCapaRequired ? 'yes' : 'no',
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
            <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger id="status" data-testid="select-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
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

        {isCapaRequired && (
          <Card className="p-6 bg-card border-2 border-primary/20">
            <h3 className="text-lg font-semibold mb-4 text-primary">FIVE WHY ANALYSIS (CAPA Required)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="capaOperator">Operator <span className="text-destructive">*</span></Label>
                <Input
                  id="capaOperator"
                  value={formData.capaOperator}
                  onChange={(e) => setFormData({ ...formData, capaOperator: e.target.value })}
                  placeholder="Enter operator name"
                  data-testid="input-capa-operator"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capaMaintenance">Maintenance <span className="text-destructive">*</span></Label>
                <Input
                  id="capaMaintenance"
                  value={formData.capaMaintenance}
                  onChange={(e) => setFormData({ ...formData, capaMaintenance: e.target.value })}
                  placeholder="Enter maintenance personnel"
                  data-testid="input-capa-maintenance"
                />
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="capaWhatHappened">What happened and where</Label>
                <Textarea
                  id="capaWhatHappened"
                  value={formData.capaWhatHappened}
                  onChange={(e) => setFormData({ ...formData, capaWhatHappened: e.target.value })}
                  placeholder="Describe what happened and where"
                  rows={2}
                  data-testid="textarea-capa-what-happened"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capaFailureMode">Failure mode</Label>
                <Input
                  id="capaFailureMode"
                  value={formData.capaFailureMode}
                  onChange={(e) => setFormData({ ...formData, capaFailureMode: e.target.value })}
                  placeholder="Describe failure mode"
                  data-testid="input-capa-failure"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capaSketch">Sketch</Label>
                <Textarea
                  id="capaSketch"
                  value={formData.capaSketch}
                  onChange={(e) => setFormData({ ...formData, capaSketch: e.target.value })}
                  placeholder="Add sketch description or reference"
                  rows={2}
                  data-testid="textarea-capa-sketch"
                />
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="font-medium">Problem Description</h4>
              <div className="space-y-2">
                <Textarea
                  id="capaProblemDescription"
                  value={formData.capaProblemDescription}
                  onChange={(e) => setFormData({ ...formData, capaProblemDescription: e.target.value })}
                  placeholder="Describe the problem in detail"
                  rows={2}
                  data-testid="textarea-capa-problem"
                />
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="font-medium">Five Whys Analysis</h4>
              {[1, 2, 3, 4, 5].map((num) => (
                <div key={num} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                  <div className="md:col-span-5 space-y-2">
                    <Label htmlFor={`capaWhy${num}`}>
                      Why ({num}) {num === 1 && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id={`capaWhy${num}`}
                      value={formData[`capaWhy${num}` as keyof typeof formData] as string}
                      onChange={(e) => setFormData({ ...formData, [`capaWhy${num}`]: e.target.value })}
                      placeholder={`Why ${num}...`}
                      data-testid={`input-capa-why${num}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`capaWhy${num}Check`}>Check</Label>
                    <Input
                      id={`capaWhy${num}Check`}
                      value={formData[`capaWhy${num}Check` as keyof typeof formData] as string}
                      onChange={(e) => setFormData({ ...formData, [`capaWhy${num}Check`]: e.target.value })}
                      placeholder="✓"
                      data-testid={`input-capa-why${num}-check`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="capa4M">Category (4M)</Label>
                <Select value={formData.capa4M} onValueChange={(value) => setFormData({ ...formData, capa4M: value })}>
                  <SelectTrigger id="capa4M" data-testid="select-capa-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="capaCorrectiveAction">Corrective Action <span className="text-destructive">*</span></Label>
                <Textarea
                  id="capaCorrectiveAction"
                  value={formData.capaCorrectiveAction}
                  onChange={(e) => setFormData({ ...formData, capaCorrectiveAction: e.target.value })}
                  placeholder="Immediate corrective action taken"
                  rows={3}
                  data-testid="textarea-capa-corrective"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capaPreventiveAction">Preventive Action <span className="text-destructive">*</span></Label>
                <Textarea
                  id="capaPreventiveAction"
                  value={formData.capaPreventiveAction}
                  onChange={(e) => setFormData({ ...formData, capaPreventiveAction: e.target.value })}
                  placeholder="Preventive action to avoid recurrence"
                  rows={3}
                  data-testid="textarea-capa-preventive"
                />
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <Label htmlFor="capaCountermeasures">Countermeasures</Label>
              <Textarea
                id="capaCountermeasures"
                value={formData.capaCountermeasures}
                onChange={(e) => setFormData({ ...formData, capaCountermeasures: e.target.value })}
                placeholder="Describe countermeasures"
                rows={2}
                data-testid="textarea-capa-countermeasures"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="capaEvidenceBefore">Evidence Before</Label>
                <Textarea
                  id="capaEvidenceBefore"
                  value={formData.capaEvidenceBefore}
                  onChange={(e) => setFormData({ ...formData, capaEvidenceBefore: e.target.value })}
                  placeholder="Evidence before corrective action"
                  rows={2}
                  data-testid="textarea-capa-evidence-before"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capaEvidenceAfter">Evidence After</Label>
                <Textarea
                  id="capaEvidenceAfter"
                  value={formData.capaEvidenceAfter}
                  onChange={(e) => setFormData({ ...formData, capaEvidenceAfter: e.target.value })}
                  placeholder="Evidence after corrective action"
                  rows={2}
                  data-testid="textarea-capa-evidence-after"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capaPreparedBy">Prepared By <span className="text-destructive">*</span></Label>
                <Input
                  id="capaPreparedBy"
                  value={formData.capaPreparedBy}
                  onChange={(e) => setFormData({ ...formData, capaPreparedBy: e.target.value })}
                  placeholder="Name"
                  data-testid="input-capa-prepared-by"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capaCheckedBy">Checked By</Label>
                <Input
                  id="capaCheckedBy"
                  value={formData.capaCheckedBy}
                  onChange={(e) => setFormData({ ...formData, capaCheckedBy: e.target.value })}
                  placeholder="Name"
                  data-testid="input-capa-checked-by"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capaReviewedBy">Reviewed By</Label>
                <Input
                  id="capaReviewedBy"
                  value={formData.capaReviewedBy}
                  onChange={(e) => setFormData({ ...formData, capaReviewedBy: e.target.value })}
                  placeholder="Name"
                  data-testid="input-capa-reviewed-by"
                />
              </div>
            </div>
          </Card>
        )}

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
