import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import BreakdownTracker from "@/pages/BreakdownTracker";
import Reports from "@/pages/Reports";
import MasterData from "@/pages/MasterData";
import MaintenancePlanner from "@/pages/MaintenancePlanner";
import YearlyPlanner from "@/pages/YearlyPlanner";
import YearlyPlanMonthView from "@/pages/YearlyPlanMonthView";
import UserManagement from "@/pages/UserManagement";
import Settings from "@/pages/Settings";
import Login from "@/pages/login";
import { AuthProvider, ProtectedRoute, useAuth } from "@/lib/auth";

function Router() {
  const [location] = useLocation();
  const isLoginPage = location === '/login';

  if (isLoginPage) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
      </Switch>
    );
  }

  return (
    <ProtectedRoute>
      <AuthenticatedApp />
    </ProtectedRoute>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  
  const style = {
    "--sidebar-width": "16rem",
  };

  const userRole = (user?.role?.toLowerCase() || "viewer") as "admin" | "supervisor" | "engineer" | "viewer";

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar role={userRole} userName={user?.name || "User"} />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b h-16">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/tracker" component={BreakdownTracker} />
              <Route path="/reports" component={Reports} />
              <Route path="/master" component={MasterData} />
              <Route path="/maintenance" component={MaintenancePlanner} />
              <Route path="/yearly-planner" component={YearlyPlanner} />
              <Route path="/yearly-planner/month/:month" component={YearlyPlanMonthView} />
              <Route path="/users" component={UserManagement} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
