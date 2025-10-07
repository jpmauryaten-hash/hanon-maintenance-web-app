import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockLines = [
  { id: 1, name: 'Line 1', description: 'Assembly Line 1' },
  { id: 2, name: 'Line 2', description: 'Assembly Line 2' }
];

const mockMachines = [
  { id: 1, name: 'CNC-101', line: 'Line 1', type: 'CNC Machine' },
  { id: 2, name: 'LATHE-205', line: 'Line 2', type: 'Lathe Machine' }
];

const mockEmployees = [
  { id: 1, name: 'John Doe', role: 'Engineer', department: 'Maintenance' },
  { id: 2, name: 'Jane Smith', role: 'Supervisor', department: 'Production' }
];

export default function MasterData() {
  const [activeTab, setActiveTab] = useState("lines");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Master Data Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage lines, machines, employees, and problem types</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="lines" data-testid="tab-lines">Lines</TabsTrigger>
          <TabsTrigger value="machines" data-testid="tab-machines">Machines</TabsTrigger>
          <TabsTrigger value="employees" data-testid="tab-employees">Employees</TabsTrigger>
          <TabsTrigger value="problems" data-testid="tab-problems">Problem Types</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="space-y-4">
          <div className="flex justify-end">
            <Button data-testid="button-add-line">
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Description</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{line.name}</TableCell>
                    <TableCell>{line.description}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="machines" className="space-y-4">
          <div className="flex justify-end">
            <Button data-testid="button-add-machine">
              <Plus className="h-4 w-4 mr-2" />
              Add Machine
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Line</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockMachines.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell className="font-medium">{machine.name}</TableCell>
                    <TableCell>{machine.line}</TableCell>
                    <TableCell>{machine.type}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex justify-end">
            <Button data-testid="button-add-employee">
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Role</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Department</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.role}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="problems" className="space-y-4">
          <div className="flex justify-end">
            <Button data-testid="button-add-problem">
              <Plus className="h-4 w-4 mr-2" />
              Add Problem Type
            </Button>
          </div>
          <Card>
            <div className="p-6 text-center text-muted-foreground">
              Problem types will be listed here
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
