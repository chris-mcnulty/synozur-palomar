import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BookOpen, Search, ArrowRight, LifeBuoy } from "lucide-react";
import { PortalBrandHeader, usePortalTenant, tenantQuery } from "@/components/portal/portal-brand";

interface KbArticleSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[] | null;
  viewCount: number;
  updatedAt: string;
}

export default function PortalKb() {
  const [, setLocation] = useLocation();
  const { tenant } = usePortalTenant();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const tenantQS = tenantQuery();

  const { data: articles, isLoading } = useQuery<KbArticleSummary[]>({
    queryKey: ["/api/portal/kb", search, tenantQS],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (tenantQS) params.set("tenantId", tenantQS);
      const res = await fetch(`/api/portal/kb?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const tags = useMemo(() => {
    const set = new Set<string>();
    (articles || []).forEach(a => (a.tags || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [articles]);

  const visible = useMemo(
    () => (articles || []).filter(a => !activeTag || (a.tags || []).includes(activeTag)),
    [articles, activeTag]
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <PortalBrandHeader tenant={tenant} />
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen
              className="h-6 w-6"
              style={{ color: tenant?.primaryColor || "hsl(var(--primary))" }}
            />
            Help Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Find answers to common questions{tenant?.name ? ` about ${tenant.name}` : ""}.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search articles..."
            className="pl-9"
            data-testid="input-kb-search"
          />
        </div>

        {tags.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Browse by category</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTag(null)}
                className={`text-xs px-2.5 py-1 rounded-full border ${!activeTag ? "text-white border-transparent" : "hover:bg-muted"}`}
                style={!activeTag ? { background: tenant?.primaryColor || "hsl(var(--primary))" } : undefined}
                data-testid="chip-all"
              >
                All
              </button>
              {tags.map(t => {
                const active = activeTag === t;
                return (
                  <button
                    key={t}
                    onClick={() => setActiveTag(active ? null : t)}
                    className={`text-xs px-2.5 py-1 rounded-full border ${active ? "text-white border-transparent" : "hover:bg-muted"}`}
                    style={active ? { background: tenant?.primaryColor || "hsl(var(--primary))" } : undefined}
                    data-testid={`chip-${t}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {isLoading && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          {!isLoading && visible.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <p>No articles match your search.</p>
                <Button variant="link" className="mt-2" onClick={() => setLocation(`/portal/new${tenantQS ? `?tenantId=${tenantQS}` : ""}`)}>
                  Submit a ticket instead <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}
          {visible.map(a => {
            const slugUrl = `/portal/kb/${a.slug}${tenantQS ? `?tenantId=${tenantQS}` : ""}`;
            return (
              <Link key={a.id} href={slugUrl}>
                <Card className="hover:border-primary cursor-pointer transition" data-testid={`kb-card-${a.slug}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {a.summary && <p className="text-sm text-muted-foreground line-clamp-2">{a.summary}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {(a.tags || []).map(t => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                      <span className="text-xs text-muted-foreground ml-auto">{a.viewCount} views</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <Card className="border-dashed">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium">Can't find what you need?</div>
              <div className="text-muted-foreground">Submit a ticket and we'll get back to you.</div>
            </div>
            <Button
              onClick={() => setLocation(`/portal/new${tenantQS ? `?tenantId=${tenantQS}` : ""}`)}
              style={tenant?.primaryColor ? { background: tenant.primaryColor } : undefined}
              data-testid="button-new-ticket"
            >
              <LifeBuoy className="h-4 w-4 mr-1" /> Submit a ticket
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
