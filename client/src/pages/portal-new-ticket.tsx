import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BookOpen, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  PortalBrandHeader,
  usePortalTenant,
  tenantQuery,
  getOrCreatePortalSessionId,
} from "@/components/portal/portal-brand";

interface KbSuggestion {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
}

export default function PortalNewTicket() {
  const [, setLocation] = useLocation();
  const { tenant } = usePortalTenant();
  const { toast } = useToast();
  const tenantQS = tenantQuery();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("question");
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<KbSuggestion[]>([]);
  const [created, setCreated] = useState<{ portalUrl: string; ticketNumber: number } | null>(null);

  // Debounced KB search-as-you-type on subject
  useEffect(() => {
    const q = subject.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    const handle = setTimeout(async () => {
      const params = new URLSearchParams({ q, limit: "3" });
      if (tenantQS) params.set("tenantId", tenantQS);
      try {
        const res = await fetch(`/api/portal/kb?${params}`);
        if (res.ok) setSuggestions((await res.json()).slice(0, 3));
      } catch {}
    }, 300);
    return () => clearTimeout(handle);
  }, [subject, tenantQS]);

  // Deflection tracking: when a user opens a suggested article we record a
  // candidate. We emit `ticket_deflected` only when the user actually
  // abandons the ticket form — i.e. they opened a suggestion, then either
  // (a) closed/hid the form tab AND did not return within 60s, or
  // (b) tore down the page (close/unload) while the candidate is still live.
  // Returning to the form clears the pending emission. Submitting cancels
  // everything.
  const emittedRef = useRef(false);
  const awayTimerRef = useRef<number | null>(null);

  function startAbandonWatcher(articleId: string) {
    emittedRef.current = false;
    try {
      sessionStorage.setItem(
        "kbDeflectionCandidate",
        JSON.stringify({ articleId, openedAt: Date.now(), tenantId: tenant?.id || tenantQS }),
      );
    } catch {}
  }

  function readCandidate(): { articleId: string; openedAt: number; tenantId?: string } | null {
    try {
      const raw = sessionStorage.getItem("kbDeflectionCandidate");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearCandidate() {
    try { sessionStorage.removeItem("kbDeflectionCandidate"); } catch {}
  }

  function clearAwayTimer() {
    if (awayTimerRef.current !== null) {
      window.clearTimeout(awayTimerRef.current);
      awayTimerRef.current = null;
    }
  }

  function emitDeflection(useBeacon: boolean) {
    if (emittedRef.current || created) return;
    const c = readCandidate();
    if (!c) return;
    if (Date.now() - c.openedAt > 60_000) { clearCandidate(); return; }
    emittedRef.current = true;
    const payload = JSON.stringify({
      tenantId: c.tenantId || undefined,
      eventType: "ticket_deflected",
      articleId: c.articleId,
      sessionId: getOrCreatePortalSessionId(),
      metadata: { subject },
    });
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/portal/events", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/portal/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
    clearCandidate();
  }

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // User left the form tab — start a 60s away-window. If they don't
        // return before it fires, count it as a deflection.
        const c = readCandidate();
        if (!c || emittedRef.current || created) return;
        const remaining = Math.max(0, 60_000 - (Date.now() - c.openedAt));
        if (remaining === 0) { clearCandidate(); return; }
        clearAwayTimer();
        awayTimerRef.current = window.setTimeout(() => emitDeflection(false), remaining);
      } else if (document.visibilityState === "visible") {
        // User came back to the form — cancel pending deflection.
        clearAwayTimer();
      }
    };
    const onPageHide = () => {
      clearAwayTimer();
      emitDeflection(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      clearAwayTimer();
    };
  }, [created, subject]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    emittedRef.current = true;
    clearAwayTimer();
    try {
      clearCandidate();
      const res = await fetch("/api/portal/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenantQS || undefined,
          subject, description, priority, category,
          ticketType: "incident",
          requesterEmail, requesterName,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit");
      }
      const data = await res.json();
      setCreated({ portalUrl: data.portalUrl, ticketNumber: data.ticketNumber });
    } catch (err: any) {
      toast({ title: "Could not submit", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="min-h-screen bg-muted/30">
        <PortalBrandHeader tenant={tenant} />
        <div className="max-w-2xl mx-auto p-6">
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <h2 className="text-xl font-semibold">Ticket #{created.ticketNumber} submitted</h2>
              <p className="text-muted-foreground text-sm">
                We've sent a confirmation email with a link to track your ticket.
              </p>
              <Button onClick={() => (window.location.href = created.portalUrl)} data-testid="button-view-ticket">
                View ticket
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <PortalBrandHeader tenant={tenant} />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Submit a ticket</h1>
        <form onSubmit={onSubmit} className="space-y-4" data-testid="form-new-ticket">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">What's going on?</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" required value={subject} onChange={e => setSubject(e.target.value)} placeholder="Briefly describe the issue" data-testid="input-subject" />
              </div>

              {suggestions.length > 0 && (
                <div className="rounded-md border border-dashed bg-muted/40 p-3" data-testid="kb-suggestions">
                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2">
                    <BookOpen className="h-3.5 w-3.5" /> Did one of these answer your question?
                  </div>
                  <ul className="space-y-1">
                    {suggestions.map(s => (
                      <li key={s.id}>
                        <a
                          href={`/portal/kb/${s.slug}${tenantQS ? `?tenantId=${tenantQS}` : ""}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded hover:bg-background"
                          onClick={() => startAbandonWatcher(s.id)}
                          data-testid={`kb-suggestion-${s.slug}`}
                        >
                          <span className="font-medium">{s.title}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" required rows={6} value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell us what's happening..." data-testid="input-description" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="feature_request">Feature request</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Your contact info</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={requesterName} onChange={e => setRequesterName(e.target.value)} data-testid="input-name" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={requesterEmail} onChange={e => setRequesterEmail(e.target.value)} data-testid="input-email" />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full"
            style={tenant?.primaryColor ? { background: tenant.primaryColor } : undefined}
            data-testid="button-submit-ticket"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit ticket
          </Button>
        </form>
      </div>
    </div>
  );
}
