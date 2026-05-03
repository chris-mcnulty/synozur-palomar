import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { setSessionId } from "@/lib/queryClient";
import { useSessionRecovery } from "@/hooks/use-session-recovery";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import SystemSettings from "@/pages/system-settings";
import AgentCardHealth from "@/pages/agent-card-health";
import About from "@/pages/about";
import UserGuide from "@/pages/user-guide";
import Changelog from "@/pages/changelog";
import Roadmap from "@/pages/roadmap";
import Support from "@/pages/support";
import SupportConsole from "@/pages/support-console";
import SupportQueuesAdmin from "@/pages/support-queues";
import SupportSlaPoliciesAdmin from "@/pages/support-sla-policies";
import SupportKbAdmin from "@/pages/support-kb-admin";
import PortalTicket from "@/pages/portal-ticket";
import PortalLookup from "@/pages/portal-lookup";
import PortalKb from "@/pages/portal-kb";
import PortalKbArticle from "@/pages/portal-kb-article";
import PortalNewTicket from "@/pages/portal-new-ticket";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";

function PermissionGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { hasAnyRole } = useAuth();
  if (!hasAnyRole(allowedRoles)) return <Redirect to="/dashboard" />;
  return <>{children}</>;
}

// Permission wrapper for support-staff routes (platform admins or tenant admins)
function SupportStaffGuard({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, hasAnyRole } = useAuth();
  if (!isPlatformAdmin && !hasAnyRole(["admin", "billing-admin"])) {
    return <Redirect to="/support" />;
  }
  return <>{children}</>;
}

function Router() {
  const [processingSession, setProcessingSession] = useState(true);
  const { isRecovering } = useSessionRecovery();
  const [, setLocation] = useLocation();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !processingSession && !isRecovering,
  });

  useEffect(() => {
    const isDevelopment = import.meta.env.MODE === "development";
    const baseTitle = "Constellation | Synozur Consulting Delivery Platform";
    document.title = isDevelopment ? `Development - ${baseTitle}` : baseTitle;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("sessionId");
    if (sessionId) {
      setSessionId(sessionId);
      localStorage.setItem("sessionId", sessionId);
      window.location.href = "/";
    } else {
      setProcessingSession(false);
    }
  }, []);

  useEffect(() => {
    const redirectPath = sessionStorage.getItem("redirectAfterLogin");
    if (redirectPath && user) {
      sessionStorage.removeItem("redirectAfterLogin");
      setLocation(redirectPath);
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (error && !user && !isLoading && !processingSession && !isRecovering) {
      const currentPath = window.location.pathname;
      if (
        currentPath !== "/login" &&
        currentPath !== "/signup" &&
        !currentPath.startsWith("/embed/") &&
        currentPath !== "/portal" &&
        !currentPath.startsWith("/portal/")
      ) {
        const lastRedirect = sessionStorage.getItem("redirectAfterLogin");
        const redirectCount = parseInt(sessionStorage.getItem("redirectLoopCount") || "0", 10);
        if (lastRedirect === currentPath && redirectCount >= 2) {
          sessionStorage.removeItem("redirectAfterLogin");
          sessionStorage.removeItem("redirectLoopCount");
        } else if (currentPath !== "/" && currentPath !== "/login") {
          sessionStorage.setItem("redirectAfterLogin", currentPath);
          sessionStorage.setItem(
            "redirectLoopCount",
            String(lastRedirect === currentPath ? redirectCount + 1 : 1),
          );
        }
        setLocation("/login");
      }
    }
  }, [error, user, isLoading, processingSession, isRecovering, setLocation]);

  if (processingSession || isLoading || isRecovering) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="text-lg text-muted-foreground">
            {isRecovering ? "Recovering session..." : "Loading..."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/portal" component={PortalLookup} />
      <Route path="/portal/kb" component={PortalKb} />
      <Route path="/portal/kb/:slug" component={PortalKbArticle} />
      <Route path="/portal/new" component={PortalNewTicket} />
      <Route path="/portal/ticket/:token" component={PortalTicket} />
      <Route path="/">{user ? <Dashboard /> : <Redirect to="/login" />}</Route>
      <Route path="/dashboard">{user ? <Dashboard /> : <Redirect to="/login" />}</Route>
      <Route path="/support/console">
        {user ? (
          <SupportStaffGuard>
            <SupportConsole />
          </SupportStaffGuard>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/support">{user ? <Support /> : <Redirect to="/login" />}</Route>
      <Route path="/system-settings">
        {user ? <SystemSettings /> : <Redirect to="/login" />}
      </Route>
      <Route path="/admin/agent-card-health">
        {user ? (
          <PermissionGuard allowedRoles={["admin"]}>
            <AgentCardHealth />
          </PermissionGuard>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/about">{user ? <About /> : <Redirect to="/login" />}</Route>
      <Route path="/user-guide">{user ? <UserGuide /> : <Redirect to="/login" />}</Route>
      <Route path="/changelog">{user ? <Changelog /> : <Redirect to="/login" />}</Route>
      <Route path="/roadmap">{user ? <Roadmap /> : <Redirect to="/login" />}</Route>
      <Route path="/support/console">
        {user ? <SupportStaffGuard><SupportConsole /></SupportStaffGuard> : <Redirect to="/login" />}
      </Route>
      <Route path="/support/queues">
        {user ? (
          <PermissionGuard allowedRoles={["admin"]}>
            <SupportQueuesAdmin />
          </PermissionGuard>
        ) : <Redirect to="/login" />}
      </Route>
      <Route path="/support/sla-policies">
        {user ? (
          <PermissionGuard allowedRoles={["admin"]}>
            <SupportSlaPoliciesAdmin />
          </PermissionGuard>
        ) : <Redirect to="/login" />}
      </Route>
      <Route path="/support/kb">
        {user ? (
          <PermissionGuard allowedRoles={["admin"]}>
            <SupportKbAdmin />
          </PermissionGuard>
        ) : <Redirect to="/login" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
