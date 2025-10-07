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
import UserManagement from "@/pages/UserManagement";
import Login from "@/pages/Login";

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

  const style = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar role="admin" userName="Admin User" />
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
              <Route path="/users" component={UserManagement} />
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
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
