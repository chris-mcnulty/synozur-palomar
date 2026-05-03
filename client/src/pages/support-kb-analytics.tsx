import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BookOpen, ShieldCheck, ThumbsUp, ThumbsDown, Eye } from "lucide-react";

interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  visibility: string;
  isPublished: boolean;
  views: number;
  helpful: number;
  notHelpful: number;
  helpfulPct: number | null;
  viewsWindow: number;
  helpfulWindow: number;
  notHelpfulWindow: number;
  helpfulPctWindow: number | null;
  deflectionsWindow: number;
}

interface KbAnalyticsResp {
  windowDays: number;
  totalDeflectionsThisMonth: number;
  totalDeflectionsWindow: number;
  articles: ArticleRow[];
}

const WINDOW_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 365 days" },
];

export default function SupportKbAnalyticsPage() {
  const [windowDays, setWindowDays] = useState("30");
  const { data, isLoading, error } = useQuery<KbAnalyticsResp>({
    queryKey: ["/api/support/kb-analytics", { windowDays }],
    queryFn: async () => {
      const r = await fetch(`/api/support/kb-analytics?windowDays=${windowDays}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  return (
    <Layout>
      <div className="p-6 space-y-6" data-testid="page-support-kb-analytics">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BookOpen className="h-6 w-6" /> KB analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              See which knowledge base articles are deflecting tickets, and which need attention.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={windowDays} onValueChange={setWindowDays}>
              <SelectTrigger className="w-44" data-testid="select-window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/support/analytics">
              <Button variant="outline" size="sm">Back to analytics</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card data-testid="kpi-deflections-month">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Deflections this month</div>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold mt-1">{data?.totalDeflectionsThisMonth ?? "—"}</div>
            </CardContent>
          </Card>
          <Card data-testid="kpi-deflections-window">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Deflections (window)</div>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold mt-1">{data?.totalDeflectionsWindow ?? "—"}</div>
            </CardContent>
          </Card>
          <Card data-testid="kpi-articles">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Articles tracked</div>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold mt-1">{data?.articles?.length ?? "—"}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-article performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : error || !data ? (
              <div className="p-6 text-sm text-muted-foreground">Failed to load KB analytics.</div>
            ) : data.articles.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No articles yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-kb-analytics">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">Article</th>
                      <th className="text-right px-4 py-2"><Eye className="inline h-3 w-3 mr-1" />Views</th>
                      <th className="text-right px-4 py-2"><ThumbsUp className="inline h-3 w-3 mr-1" />Helpful %</th>
                      <th className="text-right px-4 py-2"><ThumbsDown className="inline h-3 w-3 mr-1" />Not helpful</th>
                      <th className="text-right px-4 py-2"><ShieldCheck className="inline h-3 w-3 mr-1" />Deflections</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.articles.map((a) => (
                      <tr key={a.id} className="border-t" data-testid={`row-article-${a.id}`}>
                        <td className="px-4 py-2">
                          <div className="font-medium truncate max-w-md">{a.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px]">{a.visibility}</Badge>
                            {!a.isPublished && <Badge variant="secondary" className="text-[10px]">draft</Badge>}
                            <span className="text-xs text-muted-foreground truncate">/{a.slug}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <div>{a.viewsWindow}</div>
                          <div className="text-[11px] text-muted-foreground">all-time {a.views}</div>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {a.helpfulPctWindow == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={a.helpfulPctWindow >= 70 ? "text-green-600 dark:text-green-400" : a.helpfulPctWindow < 40 ? "text-red-600 dark:text-red-400" : ""}>
                              {a.helpfulPctWindow}%
                            </span>
                          )}
                          <div className="text-[11px] text-muted-foreground">
                            {a.helpfulWindow}/{a.helpfulWindow + a.notHelpfulWindow} votes
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <div>{a.notHelpfulWindow}</div>
                          <div className="text-[11px] text-muted-foreground">all-time {a.notHelpful}</div>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">
                          {a.deflectionsWindow}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
