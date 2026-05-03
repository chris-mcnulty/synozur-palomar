import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, ArrowLeft, LifeBuoy } from "lucide-react";
import {
  PortalBrandHeader,
  usePortalTenant,
  tenantQuery,
  getOrCreatePortalSessionId,
} from "@/components/portal/portal-brand";

interface KbArticle {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  tags: string[] | null;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  updatedAt: string;
  publishedAt: string;
}

export default function PortalKbArticle() {
  const params = useParams();
  const slug = params.slug as string;
  const [, setLocation] = useLocation();
  const { tenant } = usePortalTenant();
  const { toast } = useToast();
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const tenantQS = tenantQuery();

  const { data: article, isLoading } = useQuery<KbArticle>({
    queryKey: ["/api/portal/kb", slug, tenantQS],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantQS) params.set("tenantId", tenantQS);
      const res = await fetch(`/api/portal/kb/${slug}?${params}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const feedback = useMutation({
    mutationFn: async (helpful: boolean) => {
      if (!article) return;
      const res = await fetch(`/api/portal/kb/${article.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful, sessionId: getOrCreatePortalSessionId() }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: (_d, helpful) => {
      setVoted(helpful ? "up" : "down");
      toast({ title: "Thanks for your feedback!" });
    },
    onError: () => toast({ title: "Could not record feedback", variant: "destructive" }),
  });

  // Track that this article was opened — used by the new-ticket page to flag deflection.
  useEffect(() => {
    if (!article) return;
    const ref = document.referrer;
    const fromNewTicket = ref.includes("/portal/new");
    if (fromNewTicket) {
      try {
        sessionStorage.setItem(
          "kbDeflectionCandidate",
          JSON.stringify({ articleId: article.id, openedAt: Date.now(), tenantId: tenant?.id || tenantQS }),
        );
      } catch {}
    }
  }, [article, tenant, tenantQS]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <PortalBrandHeader tenant={tenant} />
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-muted/30">
        <PortalBrandHeader tenant={tenant} />
        <div className="max-w-3xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center">
            <p className="text-muted-foreground mb-3">Article not found.</p>
            <Button variant="outline" onClick={() => setLocation(`/portal/kb${tenantQS ? `?tenantId=${tenantQS}` : ""}`)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Help Center
            </Button>
          </CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <PortalBrandHeader tenant={tenant} />
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link href={`/portal/kb${tenantQS ? `?tenantId=${tenantQS}` : ""}`}>
          <Button variant="ghost" size="sm" className="mb-2"><ArrowLeft className="h-4 w-4 mr-1" /> Help Center</Button>
        </Link>

        <Card>
          <CardContent className="py-6 space-y-4">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="article-title">{article.title}</h1>
              {article.summary && <p className="text-muted-foreground mt-1">{article.summary}</p>}
              <div className="flex gap-2 mt-3 flex-wrap">
                {(article.tags || []).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                <span className="text-xs text-muted-foreground ml-auto">{article.viewCount} views</span>
              </div>
            </div>
            <article className="prose prose-sm max-w-none whitespace-pre-wrap" data-testid="article-body">
              {article.body}
            </article>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="text-sm font-medium mb-2">Was this helpful?</div>
            <div className="flex gap-2">
              <Button
                variant={voted === "up" ? "default" : "outline"}
                size="sm"
                disabled={voted !== null || feedback.isPending}
                onClick={() => feedback.mutate(true)}
                data-testid="button-helpful-yes"
              >
                <ThumbsUp className="h-4 w-4 mr-1" /> Yes
              </Button>
              <Button
                variant={voted === "down" ? "default" : "outline"}
                size="sm"
                disabled={voted !== null || feedback.isPending}
                onClick={() => feedback.mutate(false)}
                data-testid="button-helpful-no"
              >
                <ThumbsDown className="h-4 w-4 mr-1" /> No
              </Button>
              {voted === "down" && (
                <Button variant="link" size="sm" onClick={() => setLocation(`/portal/new${tenantQS ? `?tenantId=${tenantQS}` : ""}`)}>
                  <LifeBuoy className="h-4 w-4 mr-1" /> Submit a ticket
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
