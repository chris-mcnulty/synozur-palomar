import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  Home,
  Settings,
  ActivitySquare,
  BookOpen,
  History,
  Map,
  Info,
  LifeBuoy,
  ChevronRight,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  requiredRoles?: string[];
}

function SidebarItem({ href, icon, label, requiredRoles }: SidebarItemProps) {
  const [location] = useLocation();
  const { hasAnyRole } = useAuth();
  const isActive = location === href;
  if (requiredRoles && !hasAnyRole(requiredRoles)) return null;

  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center space-x-3 px-3 py-2 rounded-md transition-all text-sm",
        isActive
          ? "border-l-2 border-primary bg-gradient-to-r from-primary/15 to-transparent text-accent-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border-l-2 border-transparent",
      )}
      data-testid={`link-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="w-4 h-4 shrink-0">{icon}</div>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const { hasAnyRole, isPlatformAdmin } = useAuth();
  const isAdmin = hasAnyRole(["admin"]);
  const isSupportStaff = isPlatformAdmin || hasAnyRole(["admin", "billing-admin"]);

  return (
    <aside
      className="hidden lg:flex lg:flex-col w-64 bg-card border-r border-border h-[calc(100vh-73px)] sticky top-[73px]"
      data-testid="sidebar"
    >
      <ScrollArea className="flex-1">
        <div className="px-4 py-2">
          <nav className="space-y-1">
            <div className="pt-2">
              <SidebarItem href="/dashboard" icon={<Home />} label="Dashboard" />
              <SidebarItem href="/support" icon={<LifeBuoy />} label="Support" />
              {isSupportStaff && (
                <SidebarItem
                  href="/support/console"
                  icon={<LifeBuoy />}
                  label="Support Console"
                />
              )}
            </div>

            {isAdmin && (
              <div className="pt-4">
                <h3 className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administration
                </h3>
                <SidebarItem
                  href="/system-settings"
                  icon={<Settings />}
                  label="System Settings"
                />
                <SidebarItem
                  href="/admin/agent-card-health"
                  icon={<ActivitySquare />}
                  label="Agent Card Health"
                />
              </div>
            )}
          </nav>
        </div>
      </ScrollArea>

      <div className="border-t border-border px-4 py-3 space-y-1">
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors cursor-pointer group">
            <BookOpen className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left">Docs</span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 pl-3">
            <SidebarItem href="/user-guide" icon={<BookOpen />} label="User Guide" />
            <SidebarItem href="/changelog" icon={<History />} label="Changelog" />
            <SidebarItem href="/roadmap" icon={<Map />} label="Roadmap" />
            <SidebarItem href="/about" icon={<Info />} label="About" />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </aside>
  );
}
