import { 
  LayoutDashboard, 
  ClipboardList, 
  Settings, 
  Users, 
  Database,
  FileSpreadsheet,
  LogOut
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import RoleBadge from "./RoleBadge";
import { useLocation } from "wouter";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Breakdown Tracker", url: "/tracker", icon: ClipboardList },
  { title: "Reports", url: "/reports", icon: FileSpreadsheet },
];

const adminMenuItems = [
  { title: "Master Data", url: "/master", icon: Database },
  { title: "User Management", url: "/users", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  role?: "admin" | "supervisor" | "engineer" | "viewer";
  userName?: string;
}

export default function AppSidebar({ role = "admin", userName = "Admin User" }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  
  const isAdmin = role === "admin";

  return (
    <Sidebar>
      <SidebarHeader className="p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">BD</span>
          </div>
          <div>
            <h2 className="font-semibold text-lg">Breakdown</h2>
            <p className="text-xs text-muted-foreground">Tracker System</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider">Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <a href="#" onClick={(e) => { e.preventDefault(); setLocation(item.url); }}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <a href="#" onClick={(e) => { e.preventDefault(); setLocation(item.url); }}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-3 mb-3">
          <Avatar>
            <AvatarFallback className={`bg-role-${role} text-white`}>
              {userName.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <RoleBadge role={role} size="sm" />
          </div>
        </div>
        <SidebarMenuButton asChild data-testid="button-logout">
          <a href="#" onClick={async (e) => { 
            e.preventDefault(); 
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            } catch (error) {
              console.error('Logout failed:', error);
            }
          }}>
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </a>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
