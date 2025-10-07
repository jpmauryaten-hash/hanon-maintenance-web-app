import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Reports() {
  const handleExport = () => {
    console.log('Exporting to Excel...');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Importing file:', file.name);
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
