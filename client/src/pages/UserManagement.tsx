import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RoleBadge from "@/components/RoleBadge";

const mockUsers = [
  { id: 1, username: 'admin', name: 'Admin User', role: 'admin' as const, email: 'admin@example.com' },
  { id: 2, username: 'john.doe', name: 'John Doe', role: 'engineer' as const, email: 'john@example.com' },
  { id: 3, username: 'jane.smith', name: 'Jane Smith', role: 'supervisor' as const, email: 'jane@example.com' }
];

export default function UserManagement() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage system users and their roles</p>
        </div>
        <Button data-testid="button-add-user">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold uppercase">Username</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Email</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Role</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono">{user.username}</TableCell>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <RoleBadge role={user.role} size="sm" />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" data-testid={`button-edit-user-${user.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" data-testid={`button-delete-user-${user.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
