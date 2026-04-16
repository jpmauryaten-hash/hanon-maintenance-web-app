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
  Trash2,
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
import { resolveApiUrl } from "@/lib/queryClient";

const REPORT_LINKS = [
  { title: "BD Report", url: "/reports" },
  { title: "Annual PM Report", url: "/reports/annual-pm" },
  { title: "Monthly Preventive M Report", url: "/reports/monthly-pm" },
  { title: "Annual Predictive M Report", url: "/reports/annual-predictive" },
  { title: "Monthly Predictive M Report", url: "/reports/monthly-predictive" },
  { title: "Overhaul M Report", url: "/reports/overhaul" },
  { title: "Long Pending Issue", url: "/reports/long-pending" },
] as const;

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Breakdown Tracker", url: "/tracker", icon: ClipboardList },
  { title: "Reports", icon: FileSpreadsheet, children: REPORT_LINKS },
] as const;

const adminMenuItems = [
  { title: "Master Data", url: "/master", icon: Database },
  { title: "User Management", url: "/users", icon: Users },
  { title: "Deleted Breakdowns", url: "/tracker/deleted", icon: Trash2 },
  { title: "Settings", url: "/settings", icon: Settings },
];

const maintenanceMenuItems = [
  { title: "Maintenance Planner", url: "/maintenance", icon: CalendarClock },
  { title: "Yearly Planner", url: "/yearly-planner", icon: ClipboardList },
  { title: "Monthly Planner", url: "/yearly-planner/month", icon: CalendarDays },
] as const;

interface AppSidebarProps {
  role?: "admin" | "supervisor" | "engineer" | "viewer";
  userName?: string;
}

export default function AppSidebar({ role = "admin", userName = "Admin User" }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const isMonthlyRoute = location.startsWith("/yearly-planner/month/");
  const isReportsRoute = location.startsWith("/reports");
  const [reportsMenuOpen, setReportsMenuOpen] = useState(isReportsRoute);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentMonthKey = useMemo(() => {
    const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    return monthKeys[new Date().getMonth()] ?? "jan";
  }, []);
  const monthlyPlannerUrl = useMemo(
    () => `/yearly-planner/month/${currentMonthKey}?year=${currentYear}`,
    [currentMonthKey, currentYear],
  );
  
  const isAdmin = role === "admin";
  const canManageMaintenance = role === "admin" || role === "supervisor";

  useEffect(() => {
    if (isReportsRoute) {
      setReportsMenuOpen(true);
    }
  }, [isReportsRoute]);

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
              {menuItems.map((item) => {
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

                const isActive = isReportsRoute;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => setReportsMenuOpen((prev) => !prev)}
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${reportsMenuOpen ? "rotate-90" : ""}`}
                        />
                      </div>
                    </SidebarMenuButton>

                    {reportsMenuOpen ? (
                      <SidebarMenuSub>
                        {item.children.map((child) => {
                          const childActive =
                            child.url === "/reports"
                              ? location === "/reports"
                              : location.startsWith(child.url);
                          const childTestId = child.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                          return (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton
                                isActive={childActive}
                                onClick={() => setLocation(child.url)}
                                data-testid={`nav-report-${childTestId}`}
                              >
                                <span>{child.title}</span>
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

        {canManageMaintenance && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider">Maintenance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {maintenanceMenuItems.map((item) => {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.title === "Monthly Planner" ? isMonthlyRoute : location === item.url}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                      >
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setLocation(item.title === "Monthly Planner" ? monthlyPlannerUrl : item.url);
                          }}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
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
              await fetch(resolveApiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
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
