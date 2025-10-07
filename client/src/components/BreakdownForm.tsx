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

interface RootCauseEntry {
  rootCause: string;
  category: string;
  countermeasures: string;
  evidenceBefore: string;
  evidenceAfter: string;
}

interface PreventiveActionEntry {
  description: string;
  byWhom: string;
  action: string;
  evidence1: string;
  evidence2: string;
}

interface ProblemDescriptionEntry {
  description: string;
  why1: string;
  check1: string;
  why2: string;
  check2: string;
  why3: string;
  check3: string;
  why4: string;
  check4: string;
  why5: string;
  check5: string;
  category: string;
  correctiveAction: string;
  preventiveAction: string;
}

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
    capaPreparedBy: '',
    capaCheckedBy: '',
    capaReviewedBy: ''
  });

  const [problemDescriptions, setProblemDescriptions] = useState<ProblemDescriptionEntry[]>([
    { description: '', why1: '', check1: '', why2: '', check2: '', why3: '', check3: '', why4: '', check4: '', why5: '', check5: '', category: '', correctiveAction: '', preventiveAction: '' }
  ]);

  const [rootCauses, setRootCauses] = useState<RootCauseEntry[]>([
    { rootCause: '', category: '', countermeasures: '', evidenceBefore: '', evidenceAfter: '' }
  ]);

  const [preventiveActions, setPreventiveActions] = useState<PreventiveActionEntry[]>([
    { description: '', byWhom: '', action: '', evidence1: '', evidence2: '' }
  ]);

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
        capaPreparedBy: initialData.capaPreparedBy || '',
        capaCheckedBy: initialData.capaCheckedBy || '',
        capaReviewedBy: initialData.capaReviewedBy || ''
      });
      
      if (initialData.capaProblemDescriptions) {
        try {
          const parsedProblems = JSON.parse(initialData.capaProblemDescriptions);
          setProblemDescriptions(parsedProblems);
        } catch {
          setProblemDescriptions([{ description: '', why1: '', check1: '', why2: '', check2: '', why3: '', check3: '', why4: '', check4: '', why5: '', check5: '', category: '', correctiveAction: '', preventiveAction: '' }]);
        }
      }
      
      if (initialData.capaRootCauses) {
        try {
          const parsedRootCauses = JSON.parse(initialData.capaRootCauses);
          setRootCauses(parsedRootCauses);
        } catch {
          setRootCauses([{ rootCause: '', category: '', countermeasures: '', evidenceBefore: '', evidenceAfter: '' }]);
        }
      }
      
      if (initialData.capaPreventiveActions) {
        try {
          const parsedActions = JSON.parse(initialData.capaPreventiveActions);
          setPreventiveActions(parsedActions);
        } catch {
          setPreventiveActions([{ description: '', byWhom: '', action: '', evidence1: '', evidence2: '' }]);
        }
      }
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
    const firstProblem = problemDescriptions[0];
    return !!(
      firstProblem.why1 &&
      firstProblem.correctiveAction &&
      formData.capaPreparedBy
    );
  };

  const addProblemDescription = () => {
    setProblemDescriptions([...problemDescriptions, { description: '', why1: '', check1: '', why2: '', check2: '', why3: '', check3: '', why4: '', check4: '', why5: '', check5: '', category: '', correctiveAction: '', preventiveAction: '' }]);
  };

  const removeProblemDescription = (index: number) => {
    if (problemDescriptions.length > 1) {
      setProblemDescriptions(problemDescriptions.filter((_, i) => i !== index));
    }
  };

  const updateProblemDescription = (index: number, field: keyof ProblemDescriptionEntry, value: string) => {
    const updated = [...problemDescriptions];
    updated[index][field] = value;
    setProblemDescriptions(updated);
  };

  const addRootCause = () => {
    setRootCauses([...rootCauses, { rootCause: '', category: '', countermeasures: '', evidenceBefore: '', evidenceAfter: '' }]);
  };

  const removeRootCause = (index: number) => {
    if (rootCauses.length > 1) {
      setRootCauses(rootCauses.filter((_, i) => i !== index));
    }
  };

  const updateRootCause = (index: number, field: keyof RootCauseEntry, value: string) => {
    const updated = [...rootCauses];
    updated[index][field] = value;
    setRootCauses(updated);
  };

  const addPreventiveAction = () => {
    setPreventiveActions([...preventiveActions, { description: '', byWhom: '', action: '', evidence1: '', evidence2: '' }]);
  };

  const removePreventiveAction = (index: number) => {
    if (preventiveActions.length > 1) {
      setPreventiveActions(preventiveActions.filter((_, i) => i !== index));
    }
  };

  const updatePreventiveAction = (index: number, field: keyof PreventiveActionEntry, value: string) => {
    const updated = [...preventiveActions];
    updated[index][field] = value;
    setPreventiveActions(updated);
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
      capaProblemDescriptions: JSON.stringify(problemDescriptions),
      capaRootCauses: JSON.stringify(rootCauses),
      capaPreventiveActions: JSON.stringify(preventiveActions),
    };
    
    onSubmit?.(submitData);
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Problem Description & Five Whys Analysis</h4>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={addProblemDescription}
                  data-testid="button-add-problem-description"
                >
                  Add More
                </Button>
              </div>
              
              {problemDescriptions.map((problem, index) => (
                <Card key={index} className="p-4 relative">
                  {problemDescriptions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => removeProblemDescription(index)}
                      data-testid={`button-remove-problem-${index}`}
                    >
                      ✕
                    </Button>
                  )}
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`problemDesc-${index}`}>
                        Problem Description {index === 0 && <span className="text-destructive">*</span>}
                      </Label>
                      <Textarea
                        id={`problemDesc-${index}`}
                        value={problem.description}
                        onChange={(e) => updateProblemDescription(index, 'description', e.target.value)}
                        placeholder="Describe the problem in detail"
                        rows={2}
                        data-testid={`textarea-problem-desc-${index}`}
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium">Five Whys</h5>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <div key={num} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                          <div className="md:col-span-5 space-y-2">
                            <Label htmlFor={`why${num}-${index}`}>
                              Why ({num}) {num === 1 && index === 0 && <span className="text-destructive">*</span>}
                            </Label>
                            <Input
                              id={`why${num}-${index}`}
                              value={problem[`why${num}` as keyof ProblemDescriptionEntry] as string}
                              onChange={(e) => updateProblemDescription(index, `why${num}` as keyof ProblemDescriptionEntry, e.target.value)}
                              placeholder={`Why ${num}...`}
                              data-testid={`input-why${num}-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`check${num}-${index}`}>Check</Label>
                            <Input
                              id={`check${num}-${index}`}
                              value={problem[`check${num}` as keyof ProblemDescriptionEntry] as string}
                              onChange={(e) => updateProblemDescription(index, `check${num}` as keyof ProblemDescriptionEntry, e.target.value)}
                              placeholder="✓"
                              data-testid={`input-check${num}-${index}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`category-${index}`}>Category (4M)</Label>
                      <Input
                        id={`category-${index}`}
                        value={problem.category}
                        onChange={(e) => updateProblemDescription(index, 'category', e.target.value)}
                        placeholder="Enter 4M category"
                        data-testid={`input-category-${index}`}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`correctiveAction-${index}`}>
                          Corrective Action {index === 0 && <span className="text-destructive">*</span>}
                        </Label>
                        <Textarea
                          id={`correctiveAction-${index}`}
                          value={problem.correctiveAction}
                          onChange={(e) => updateProblemDescription(index, 'correctiveAction', e.target.value)}
                          placeholder="Immediate corrective action taken"
                          rows={3}
                          data-testid={`textarea-corrective-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`preventiveAction-${index}`}>Preventive Action</Label>
                        <Textarea
                          id={`preventiveAction-${index}`}
                          value={problem.preventiveAction}
                          onChange={(e) => updateProblemDescription(index, 'preventiveAction', e.target.value)}
                          placeholder="Preventive action for this problem"
                          rows={3}
                          data-testid={`textarea-preventive-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Root Causes & Countermeasures</h4>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={addRootCause}
                  data-testid="button-add-root-cause"
                >
                  Add More
                </Button>
              </div>
              
              {rootCauses.map((rootCause, index) => (
                <Card key={index} className="p-4 relative">
                  {rootCauses.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => removeRootCause(index)}
                      data-testid={`button-remove-root-cause-${index}`}
                    >
                      ✕
                    </Button>
                  )}
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`rootCause-${index}`}>Root causes</Label>
                      <Textarea
                        id={`rootCause-${index}`}
                        value={rootCause.rootCause}
                        onChange={(e) => updateRootCause(index, 'rootCause', e.target.value)}
                        placeholder="Describe root causes"
                        rows={2}
                        data-testid={`textarea-root-cause-${index}`}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`rcCategory-${index}`}>Cat.(*)</Label>
                      <Input
                        id={`rcCategory-${index}`}
                        value={rootCause.category}
                        onChange={(e) => updateRootCause(index, 'category', e.target.value)}
                        placeholder="Enter category"
                        data-testid={`input-rc-category-${index}`}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`countermeasures-${index}`}>Countermeasures</Label>
                      <Textarea
                        id={`countermeasures-${index}`}
                        value={rootCause.countermeasures}
                        onChange={(e) => updateRootCause(index, 'countermeasures', e.target.value)}
                        placeholder="Describe countermeasures"
                        rows={2}
                        data-testid={`textarea-countermeasures-${index}`}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`evidenceBefore-${index}`}>Evidence -1 Before</Label>
                        <Textarea
                          id={`evidenceBefore-${index}`}
                          value={rootCause.evidenceBefore}
                          onChange={(e) => updateRootCause(index, 'evidenceBefore', e.target.value)}
                          placeholder="Evidence before"
                          rows={2}
                          data-testid={`textarea-evidence-before-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`evidenceAfter-${index}`}>Evidence -2 After</Label>
                        <Textarea
                          id={`evidenceAfter-${index}`}
                          value={rootCause.evidenceAfter}
                          onChange={(e) => updateRootCause(index, 'evidenceAfter', e.target.value)}
                          placeholder="Evidence after"
                          rows={2}
                          data-testid={`textarea-evidence-after-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Preventive Action Plan</h4>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={addPreventiveAction}
                  data-testid="button-add-preventive-action"
                >
                  Add More
                </Button>
              </div>
              
              {preventiveActions.map((action, index) => (
                <Card key={index} className="p-4 relative">
                  {preventiveActions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => removePreventiveAction(index)}
                      data-testid={`button-remove-preventive-action-${index}`}
                    >
                      ✕
                    </Button>
                  )}
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`paDescription-${index}`}>Preventive Action Description</Label>
                      <Textarea
                        id={`paDescription-${index}`}
                        value={action.description}
                        onChange={(e) => updatePreventiveAction(index, 'description', e.target.value)}
                        placeholder="Describe preventive action"
                        rows={2}
                        data-testid={`textarea-pa-description-${index}`}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`paByWhom-${index}`}>By whom</Label>
                        <Input
                          id={`paByWhom-${index}`}
                          value={action.byWhom}
                          onChange={(e) => updatePreventiveAction(index, 'byWhom', e.target.value)}
                          placeholder="Person responsible"
                          data-testid={`input-pa-bywhom-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`paAction-${index}`}>Preventive Action</Label>
                        <Input
                          id={`paAction-${index}`}
                          value={action.action}
                          onChange={(e) => updatePreventiveAction(index, 'action', e.target.value)}
                          placeholder="Action to be taken"
                          data-testid={`input-pa-action-${index}`}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`paEvidence1-${index}`}>Evidence -1</Label>
                        <Textarea
                          id={`paEvidence1-${index}`}
                          value={action.evidence1}
                          onChange={(e) => updatePreventiveAction(index, 'evidence1', e.target.value)}
                          placeholder="First evidence"
                          rows={2}
                          data-testid={`textarea-pa-evidence1-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`paEvidence2-${index}`}>Evidence -2</Label>
                        <Textarea
                          id={`paEvidence2-${index}`}
                          value={action.evidence2}
                          onChange={(e) => updatePreventiveAction(index, 'evidence2', e.target.value)}
                          placeholder="Second evidence"
                          rows={2}
                          data-testid={`textarea-pa-evidence2-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
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
