import { useAuth } from "@/hooks/use-auth";
import { getRoleDisplayName } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, setSessionId } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MobileNav } from "./mobile-nav";

export function Header() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      setSessionId(null);
      localStorage.removeItem("sessionId");
      queryClient.clear();
      setLocation("/login");
    },
    onError: (err: any) => {
      toast({ title: "Logout failed", description: err?.message, variant: "destructive" });
    },
  });

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between h-[73px] px-4">
        <div className="flex items-center gap-3">
          <MobileNav />
          <div className="font-semibold text-lg">Constellation</div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user && (
            <div className="hidden md:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground">
                {getRoleDisplayName(user.role)}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-1" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
