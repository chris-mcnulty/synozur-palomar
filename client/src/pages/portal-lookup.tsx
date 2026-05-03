import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LifeBuoy, Loader2, BookOpen, Plus } from "lucide-react";
import { Link } from "wouter";

export default function PortalLookup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const urlTenantId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("tenantId") || "";
  }, []);
  const [ticketNumber, setTicketNumber] = useState("");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState(urlTenantId);
  const [submitting, setSubmitting] = useState(false);
  const tenantQs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketNumber: Number(ticketNumber), email, tenantId: tenantId || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Lookup failed");
      }
      const data = await res.json();
      const url = new URL(data.portalUrl);
      setLocation(url.pathname);
    } catch (err: any) {
      toast({ title: "Could not find ticket", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2"><LifeBuoy className="h-10 w-10 text-primary" /></div>
          <CardTitle>Synozur Support Portal</CardTitle>
          <CardDescription>Find your ticket using its number and the email address you submitted it from.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Link href={`/portal/kb${tenantQs}`}><Button variant="outline" size="sm" className="flex-1" data-testid="link-kb"><BookOpen className="h-4 w-4 mr-1" /> Help Center</Button></Link>
            <Link href={`/portal/new${tenantQs}`}><Button variant="outline" size="sm" className="flex-1" data-testid="link-new-ticket"><Plus className="h-4 w-4 mr-1" /> New ticket</Button></Link>
          </div>
          <form onSubmit={onSubmit} className="space-y-4" data-testid="portal-lookup-form">
            <div>
              <Label htmlFor="ticketNumber">Ticket number</Label>
              <Input id="ticketNumber" type="number" required value={ticketNumber} onChange={e => setTicketNumber(e.target.value)} placeholder="1234" data-testid="input-ticket-number" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" data-testid="input-email" />
            </div>
            <details>
              <summary className="text-xs text-muted-foreground cursor-pointer">Advanced</summary>
              <div className="mt-2">
                <Label htmlFor="tenantId" className="text-xs">Workspace ID (optional)</Label>
                <Input id="tenantId" value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Auto-detected from URL" />
              </div>
            </details>
            <Button type="submit" className="w-full" disabled={submitting} data-testid="button-find-ticket">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Find my ticket
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
