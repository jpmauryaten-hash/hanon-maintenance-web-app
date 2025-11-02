import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  Users,
  Database,
  FileSpreadsheet,
  CalendarClock,
  CalendarDays,
  LogOut,
  ChevronRight,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import RoleBadge from "./RoleBadge";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";

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

const MONTHLY_MONTHS = [
  { key: "jan", label: "January" },
  { key: "feb", label: "February" },
  { key: "mar", label: "March" },
  { key: "apr", label: "April" },
  { key: "may", label: "May" },
  { key: "jun", label: "June" },
  { key: "jul", label: "July" },
  { key: "aug", label: "August" },
  { key: "sep", label: "September" },
  { key: "oct", label: "October" },
  { key: "nov", label: "November" },
  { key: "dec", label: "December" },
] as const;

const maintenanceMenuItems = [
  { title: "Maintenance Planner", url: "/maintenance", icon: CalendarClock },
  { title: "Yearly Planner", url: "/yearly-planner", icon: ClipboardList },
  { title: "Monthly Planner", icon: CalendarDays, children: MONTHLY_MONTHS },
] as const;

interface AppSidebarProps {
  role?: "admin" | "supervisor" | "engineer" | "viewer";
  userName?: string;
}

export default function AppSidebar({ role = "admin", userName = "Admin User" }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const isMonthlyRoute = location.startsWith("/yearly-planner/month/");
  const [monthlyMenuOpen, setMonthlyMenuOpen] = useState(isMonthlyRoute);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  
  const isAdmin = role === "admin";
  const canManageMaintenance = role === "admin" || role === "supervisor";

  useEffect(() => {
    if (isMonthlyRoute) {
      setMonthlyMenuOpen(true);
    }
  }, [isMonthlyRoute]);

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

        {canManageMaintenance && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider">Maintenance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {maintenanceMenuItems.map((item) => {
                  if (!("children" in item)) {
                    return (
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
                    );
                  }

                  const isActive = isMonthlyRoute;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => setMonthlyMenuOpen((prev) => !prev)}
                        isActive={isActive}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </div>
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${monthlyMenuOpen ? "rotate-90" : ""}`}
                          />
                        </div>
                      </SidebarMenuButton>

                      {monthlyMenuOpen ? (
                        <SidebarMenuSub>
                          {item.children.map((month) => {
                            const monthUrl = `/yearly-planner/month/${month.key}?year=${currentYear}`;
                            const monthActive = location === monthUrl;
                            return (
                              <SidebarMenuSubItem key={month.key}>
                                <SidebarMenuSubButton
                                  isActive={monthActive}
                                  onClick={() => setLocation(monthUrl)}
                                  data-testid={`nav-monthly-${month.key}`}
                                >
                                  <span>{month.label}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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
