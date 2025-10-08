import { Badge } from "@/components/ui/badge";

interface RoleBadgeProps {
  role: "admin" | "supervisor" | "engineer" | "viewer";
  size?: "sm" | "default";
}

export default function RoleBadge({ role, size = "default" }: RoleBadgeProps) {
  const config: Record<string, { label: string; className: string }> = {
    admin: {
      label: "Admin",
      className: "bg-role-admin text-white"
    },
    supervisor: {
      label: "Supervisor",
      className: "bg-role-supervisor text-white"
    },
    engineer: {
      label: "Engineer",
      className: "bg-role-engineer text-white"
    },
    viewer: {
      label: "Viewer",
      className: "bg-role-viewer text-white"
    }
  };

  const roleConfig = config[role] || {
    label: role || "Unknown",
    className: "bg-gray-500 text-white"
  };

  const { label, className } = roleConfig;

  return (
    <Badge 
      className={`font-semibold ${className} ${size === 'sm' ? 'text-xs' : ''}`}
      data-testid={`badge-role-${role}`}
    >
      {label}
    </Badge>
  );
}
