import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Settings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    companyName: "Manufacturing Company",
    emailNotifications: true,
    autoBackup: true,
    sessionTimeout: "30"
  });

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage application settings and preferences</p>
      </div>

      <div className="grid gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">General Settings</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                data-testid="input-company-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
                data-testid="input-session-timeout"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">System Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Application Version</span>
              <span className="text-sm font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Database Status</span>
              <span className="text-sm font-medium text-green-600">Connected</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-muted-foreground">Last Backup</span>
              <span className="text-sm font-medium">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} data-testid="button-save-settings">
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
