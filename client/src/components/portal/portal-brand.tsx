import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { LifeBuoy, BookOpen } from "lucide-react";

export interface PortalTenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  logoUrlDark: string | null;
  color: string | null;
  primaryColor: string | null;
}

export function tenantQuery(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("tenantId");
}

export function getOrCreatePortalSessionId(): string {
  const KEY = "portalSessionId";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(KEY, id);
  return id;
}

export function usePortalTenant() {
  const tid = tenantQuery();
  const { data, isLoading } = useQuery<PortalTenant>({
    queryKey: ["/api/portal/tenant", tid],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tid) params.set("tenantId", tid);
      const res = await fetch(`/api/portal/tenant?${params}`);
      if (!res.ok) throw new Error("not found");
      return res.json();
    },
    retry: false,
  });
  useEffect(() => {
    if (data?.primaryColor) {
      document.documentElement.style.setProperty("--portal-primary", data.primaryColor);
    }
  }, [data?.primaryColor]);
  return { tenant: data, isLoading };
}

export function PortalBrandHeader({ tenant }: { tenant?: PortalTenant }) {
  const tid = tenant?.id || tenantQuery();
  const qs = tid ? `?tenantId=${tid}` : "";
  return (
    <header className="bg-background border-b">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href={`/portal/kb${qs}`}>
          <div className="flex items-center gap-2 cursor-pointer">
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-auto" />
            ) : (
              <div
                className="h-8 w-8 rounded flex items-center justify-center text-white text-sm font-semibold"
                style={{ background: tenant?.primaryColor || "hsl(var(--primary))" }}
              >
                {(tenant?.name || "S").charAt(0)}
              </div>
            )}
            <span className="font-semibold text-sm">{tenant?.name || "Support"}</span>
          </div>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href={`/portal/kb${qs}`}>
            <span className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              <BookOpen className="h-4 w-4" /> Help Center
            </span>
          </Link>
          <Link href={`/portal/new${qs}`}>
            <span className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              <LifeBuoy className="h-4 w-4" /> Submit ticket
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
