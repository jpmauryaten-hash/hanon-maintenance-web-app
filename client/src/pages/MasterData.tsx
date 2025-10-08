import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";

export default function MasterData() {
  const [activeTab, setActiveTab] = useState("lines");

  const { data: lines = [], isLoading: linesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/lines"] 
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/machines"] 
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/employees"] 
  });

  const { data: problemTypes = [], isLoading: problemTypesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/problem-types"] 
  });

  const { data: subLines = [] } = useQuery<any[]>({ 
    queryKey: ["/api/sub-lines"] 
  });

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
                {linesLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No lines found</TableCell>
                  </TableRow>
                ) : (
                  lines.map((line) => (
                    <TableRow key={line.id} data-testid={`row-line-${line.id}`}>
                      <TableCell className="font-medium">{line.name}</TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" data-testid={`button-edit-line-${line.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-line-${line.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
                  <TableHead className="text-xs font-semibold uppercase">Sub Line</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {machinesLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : machines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No machines found</TableCell>
                  </TableRow>
                ) : (
                  machines.map((machine) => {
                    const line = lines.find(l => l.id === machine.lineId);
                    const subLine = subLines.find(sl => sl.id === machine.subLineId);
                    return (
                      <TableRow key={machine.id} data-testid={`row-machine-${machine.id}`}>
                        <TableCell className="font-medium">{machine.name}</TableCell>
                        <TableCell>{line?.name || '-'}</TableCell>
                        <TableCell>{subLine?.name || '-'}</TableCell>
                        <TableCell>{machine.type || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="icon" variant="ghost" data-testid={`button-edit-machine-${machine.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" data-testid={`button-delete-machine-${machine.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
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
                {employeesLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No employees found</TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.role || '-'}</TableCell>
                      <TableCell>{employee.department || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" data-testid={`button-edit-employee-${employee.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-employee-${employee.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Description</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problemTypesLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : problemTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No problem types found</TableCell>
                  </TableRow>
                ) : (
                  problemTypes.map((problemType) => (
                    <TableRow key={problemType.id} data-testid={`row-problem-${problemType.id}`}>
                      <TableCell className="font-medium">{problemType.name}</TableCell>
                      <TableCell>{problemType.description || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" data-testid={`button-edit-problem-${problemType.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-problem-${problemType.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
