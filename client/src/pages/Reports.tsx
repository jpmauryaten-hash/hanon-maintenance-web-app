import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

export default function Reports() {
  const { toast } = useToast();
  
  const { data: breakdowns } = useQuery<any[]>({ 
    queryKey: ['/api/breakdowns'],
  });

  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/lines"] });
  const { data: subLines = [] } = useQuery<any[]>({ queryKey: ["/api/sub-lines"] });
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });
  const { data: problemTypes = [] } = useQuery<any[]>({ queryKey: ["/api/problem-types"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const handleExport = () => {
    if (!breakdowns || breakdowns.length === 0) {
      toast({
        title: "No Data",
        description: "There are no breakdowns to export",
        variant: "destructive"
      });
      return;
    }

    const exportData = breakdowns.map((b: any) => {
      const line = lines.find(l => l.id === b.lineId);
      const subLine = subLines.find(sl => sl.id === b.subLineId);
      const machine = machines.find(m => m.id === b.machineId);
      const problemType = problemTypes.find(pt => pt.id === b.problemTypeId);
      const attendBy = employees.find(e => e.id === b.attendById);
      const closedBy = employees.find(e => e.id === b.closedById);

      let problemDescriptions = [];
      let rootCauses = [];
      let preventiveActions = [];

      try {
        if (b.capaProblemDescriptions) {
          problemDescriptions = JSON.parse(b.capaProblemDescriptions);
        }
      } catch {}

      try {
        if (b.capaRootCauses) {
          rootCauses = JSON.parse(b.capaRootCauses);
        }
      } catch {}

      try {
        if (b.capaPreventiveActions) {
          preventiveActions = JSON.parse(b.capaPreventiveActions);
        }
      } catch {}

      return {
        Date: b.date,
        Shift: b.shift,
        Line: line?.name || '-',
        'Sub Line': subLine?.name || '-',
        Machine: machine?.name || '-',
        'Problem Type': problemType?.name || '-',
        Priority: b.priority,
        Status: b.status,
        'Start Time': b.startTime,
        'Finish Time': b.finishTime || '-',
        'Total Minutes': b.totalMinutes || '-',
        'Action Taken': b.actionTaken || '-',
        'Root Cause': b.rootCause || '-',
        'Major Contribution': b.majorContribution || '-',
        'Major Contribution Time': b.majorContributionTime || '-',
        'Attended By': attendBy?.name || '-',
        'Closed By': closedBy?.name || '-',
        'Remark': b.remark || '-',
        'CAPA Operator': b.capaOperator || '-',
        'CAPA Maintenance': b.capaMaintenance || '-',
        'CAPA What Happened': b.capaWhatHappened || '-',
        'CAPA Failure Mode': b.capaFailureMode || '-',
        'CAPA Sketch': b.capaSketch || '-',
        'CAPA Problem Descriptions': problemDescriptions.map((p: any, i: number) => 
          `Problem ${i + 1}: ${p.description || ''} | Why1: ${p.why1 || ''} | Why2: ${p.why2 || ''} | Why3: ${p.why3 || ''} | Why4: ${p.why4 || ''} | Why5: ${p.why5 || ''} | Category: ${p.category || ''} | Corrective Action: ${p.correctiveAction || ''} | Preventive Action: ${p.preventiveAction || ''}`
        ).join(' || ') || '-',
        'CAPA Root Causes': rootCauses.map((rc: any, i: number) => 
          `${i + 1}. Root Cause: ${rc.rootCause || ''} | Category: ${rc.category || ''} | Countermeasures: ${rc.countermeasures || ''} | Evidence Before: ${rc.evidenceBefore || ''} | Evidence After: ${rc.evidenceAfter || ''}`
        ).join(' || ') || '-',
        'CAPA Preventive Actions': preventiveActions.map((pa: any, i: number) => 
          `${i + 1}. Description: ${pa.description || ''} | By Whom: ${pa.byWhom || ''} | Action: ${pa.action || ''} | Evidence 1: ${pa.evidence1 || ''} | Evidence 2: ${pa.evidence2 || ''}`
        ).join(' || ') || '-',
        'CAPA Prepared By': b.capaPreparedBy || '-',
        'CAPA Checked By': b.capaCheckedBy || '-',
        'CAPA Reviewed By': b.capaReviewedBy || '-',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Breakdowns");
    XLSX.writeFile(wb, `breakdown_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: `${breakdowns.length} breakdown records exported to Excel`,
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          console.log('Imported data:', jsonData);
          
          toast({
            title: "Import Started",
            description: `Processing ${jsonData.length} rows from Excel`,
          });
        } catch (error) {
          toast({
            title: "Import Failed",
            description: "Error reading Excel file",
            variant: "destructive"
          });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Export and import breakdown data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Export Data</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Download breakdown reports and analytics as Excel file
          </p>
          <Button onClick={handleExport} className="w-full" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Import Data</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Upload Excel file to import breakdown data and master information
          </p>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-md p-8 text-center hover-elevate">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-sm text-muted-foreground">
                  Drop Excel file or click to browse
                </span>
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
                data-testid="input-file-upload"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
