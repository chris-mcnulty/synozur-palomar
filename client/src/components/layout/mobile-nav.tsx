import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Menu, Home, Settings, ActivitySquare, LifeBuoy, BookOpen, Mail } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  onNavigate: () => void;
  requiredRoles?: string[];
}

function NavLink({ href, icon, label, onNavigate, requiredRoles }: NavLinkProps) {
  const [location] = useLocation();
  const { hasAnyRole } = useAuth();
  if (requiredRoles && !hasAnyRole(requiredRoles)) return null;
  const isActive = location === href;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50",
      )}
    >
      <div className="w-4 h-4">{icon}</div>
      <span>{label}</span>
    </Link>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Palomar</SheetTitle>
        </SheetHeader>
        <nav className="mt-4 space-y-1">
          <NavLink href="/dashboard" icon={<Home />} label="Dashboard" onNavigate={close} />
          <NavLink href="/support" icon={<LifeBuoy />} label="Support" onNavigate={close} />
          <NavLink
            href="/system-settings"
            icon={<Settings />}
            label="System Settings"
            onNavigate={close}
            requiredRoles={["admin"]}
          />
          <NavLink
            href="/admin/agent-card-health"
            icon={<ActivitySquare />}
            label="Agent Card Health"
            onNavigate={close}
            requiredRoles={["admin"]}
          />
          <NavLink
            href="/admin/support-email-subscriptions"
            icon={<Mail />}
            label="Support Mailbox"
            onNavigate={close}
            requiredRoles={["admin"]}
          />
          <NavLink href="/user-guide" icon={<BookOpen />} label="User Guide" onNavigate={close} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
