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

  const handleExport = () => {
    if (!breakdowns || breakdowns.length === 0) {
      toast({
        title: "No Data",
        description: "There are no breakdowns to export",
        variant: "destructive"
      });
      return;
    }

    const exportData = breakdowns.map((b: any) => ({
      Date: b.date,
      Shift: b.shift,
      Line: b.line?.name,
      'Sub Line': b.subLine?.name || '-',
      Machine: b.machine?.name,
      'Problem Type': b.problemType?.name,
      Priority: b.priority,
      Status: b.status,
      'Start Time': b.startTime,
      'Finish Time': b.finishTime || '-',
      'Total Minutes': b.totalMinutes || '-',
      'Attend By': b.attendBy?.name,
      'Closed By': b.closedBy?.name || '-',
      'Action Taken': b.actionTaken || '-',
      'Root Cause': b.rootCause || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Breakdowns");
    XLSX.writeFile(wb, `breakdown_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: "Breakdown data exported to Excel",
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
