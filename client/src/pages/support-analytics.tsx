import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Activity, AlertTriangle, Clock, Smile } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LineChart, Line, Legend, Cell, PieChart, Pie,
} from "recharts";

interface AnalyticsResp {
  summary: {
    open: number;
    awaitingCustomer: number;
    resolved7d: number;
    created7d: number;
    csatAvg30d: number | null;
    breachRate7d: number;
  };
  volumeByDay: Array<{ day: string; created: number; resolved: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  byApplication: Array<{ application: string; count: number }>;
  responseTimes: { medianFirstResponseMinutes: number | null; medianResolutionMinutes: number | null };
}

const PALETTE = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function formatMinutes(m: number | null | undefined): string {
  if (m === null || m === undefined || !isFinite(m)) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default function SupportAnalyticsPage() {
  const { data, isLoading, error } = useQuery<AnalyticsResp>({
    queryKey: ["/api/support/analytics"],
    staleTime: 60_000,
  });

  const volumeChartConfig = useMemo(() => ({
    created: { label: "Created", color: "hsl(var(--chart-1))" },
    resolved: { label: "Resolved", color: "hsl(var(--chart-2))" },
  }), []);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </Layout>
    );
  }
  if (error || !data) {
    return (
      <Layout>
        <div className="p-6"><Card><CardContent className="p-6 text-sm text-muted-foreground">Failed to load analytics.</CardContent></Card></div>
      </Layout>
    );
  }

  const { summary, volumeByDay, byPriority, byCategory, bySource, byApplication, responseTimes } = data;

  return (
    <Layout>
      <div className="p-6 space-y-6" data-testid="page-support-analytics">
        <div>
          <h1 className="text-2xl font-semibold">Support analytics</h1>
          <p className="text-sm text-muted-foreground">Operational health for the last 7 to 30 days. Refreshes every 60 seconds.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Open" value={summary.open} icon={Activity} testId="kpi-open" />
          <KpiCard label="Awaiting customer" value={summary.awaitingCustomer} icon={Clock} testId="kpi-awaiting" />
          <KpiCard label="Created (7d)" value={summary.created7d} testId="kpi-created" />
          <KpiCard label="Resolved (7d)" value={summary.resolved7d} testId="kpi-resolved" />
          <KpiCard label="SLA breach rate (7d)" value={`${Math.round((summary.breachRate7d || 0) * 100)}%`} icon={AlertTriangle} testId="kpi-breach" />
          <KpiCard label="CSAT (30d)" value={summary.csatAvg30d != null ? summary.csatAvg30d.toFixed(2) : "—"} icon={Smile} testId="kpi-csat" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Ticket volume (14 days)</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={volumeChartConfig} className="h-[260px] w-full">
                <LineChart data={volumeByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line type="monotone" dataKey="created" stroke="var(--color-created)" strokeWidth={2} />
                  <Line type="monotone" dataKey="resolved" stroke="var(--color-resolved)" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Open tickets by priority</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byPriority}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="priority" />
                  <YAxis allowDecimals={false} />
                  <Bar dataKey="count">
                    {byPriority.map((_, idx) => <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">By category (30d)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byCategory} dataKey="count" nameKey="category" outerRadius={90} label>
                    {byCategory.map((_, idx) => <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />)}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">By source (30d)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={bySource} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="source" width={100} />
                  <Bar dataKey="count" fill="hsl(var(--chart-3))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Top applications (30d)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byApplication}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="application" />
                  <YAxis allowDecimals={false} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Median first-response (30d)</CardTitle></CardHeader>
            <CardContent className="text-3xl font-semibold" data-testid="metric-fr-median">{formatMinutes(responseTimes.medianFirstResponseMinutes)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Median time-to-resolution (30d)</CardTitle></CardHeader>
            <CardContent className="text-3xl font-semibold" data-testid="metric-res-median">{formatMinutes(responseTimes.medianResolutionMinutes)}</CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function KpiCard({ label, value, icon: Icon, testId }: { label: string; value: string | number; icon?: any; testId?: string }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
