import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Loader2, MessageSquare, Send, Star, AlertCircle, CheckCircle2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-purple-100 text-purple-800",
  pending: "bg-orange-100 text-orange-800",
  on_hold: "bg-gray-100 text-gray-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-slate-200 text-slate-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function PortalTicket() {
  const params = useParams();
  const token = params.token;
  const { toast } = useToast();
  const [reply, setReply] = useState("");
  const [csatScore, setCsatScore] = useState<number | null>(null);
  const [csatComment, setCsatComment] = useState("");

  const { data: ticket, isLoading } = useQuery<any>({
    queryKey: ["/api/portal/tickets", token],
  });

  const replyMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/portal/tickets/${token}/replies`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["/api/portal/tickets", token] });
      toast({ title: "Reply added" });
    },
    onError: (err: any) => toast({ title: "Could not post reply", description: err.message, variant: "destructive" }),
  });

  const csatMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portal/tickets/${token}/csat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: csatScore, comment: csatComment }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/tickets", token] });
      toast({ title: "Thanks for your feedback!" });
    },
    onError: (err: any) => toast({ title: "Could not submit feedback", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="max-w-3xl mx-auto p-6 space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }
  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" />Ticket not found</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">This portal link is invalid or has expired.</p>
            <Button className="mt-3" variant="outline" onClick={() => (window.location.href = "/portal")}>Look up by ticket number</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const showCsat = ticket.status === "resolved" || ticket.status === "closed";
  const repliesAndActivity = [
    ...(ticket.replies || []).map((r: any) => ({ ...r, kind: "reply" })),
    ...(ticket.activity || []).map((a: any) => ({ ...a, kind: "activity" })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Synozur Support</h1>
            <p className="text-xs text-muted-foreground">{ticket.applicationSource}</p>
          </div>
          <Badge className={STATUS_COLORS[ticket.status] || ""} data-testid="badge-status">
            {ticket.status.replace(/_/g, " ")}
          </Badge>
        </header>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle data-testid="ticket-subject">#{ticket.ticketNumber} — {ticket.subject}</CardTitle>
                <CardDescription>
                  Filed {format(new Date(ticket.createdAt), "PPP")} · Priority {ticket.priority} · {ticket.ticketType}
                  {ticket.slaBreached && <span className="ml-2 text-destructive font-medium">SLA breached</span>}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm" data-testid="ticket-description">{ticket.description}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" />Conversation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {repliesAndActivity.length === 0 && <p className="text-sm text-muted-foreground">No replies yet.</p>}
            {repliesAndActivity.map((item: any) => item.kind === "reply" ? (
              <div key={item.id} className="border-l-2 border-primary pl-3 py-1">
                <div className="text-xs text-muted-foreground">
                  {item.author?.name || "You"} · {format(new Date(item.createdAt), "Pp")}
                </div>
                <div className="text-sm whitespace-pre-wrap mt-1">{item.message}</div>
              </div>
            ) : (
              <div key={item.id} className="text-xs text-muted-foreground italic">
                {format(new Date(item.createdAt), "Pp")} · {item.action.replace(/_/g, " ")}
                {item.fieldName && ` · ${item.fieldName}: ${item.oldValue || "—"} → ${item.newValue || "—"}`}
              </div>
            ))}

            {ticket.status !== "closed" && ticket.status !== "cancelled" && (
              <div className="pt-2 border-t">
                <Textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Add a reply..." rows={3} data-testid="textarea-reply" />
                <Button className="mt-2" disabled={!reply.trim() || replyMutation.isPending} onClick={() => replyMutation.mutate(reply)} data-testid="button-send-reply">
                  {replyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Send reply
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {showCsat && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />How did we do?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setCsatScore(n)} aria-label={`${n} stars`} data-testid={`button-csat-${n}`}>
                    <Star className={`h-7 w-7 ${csatScore && n <= csatScore ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <Textarea value={csatComment} onChange={e => setCsatComment(e.target.value)} placeholder="Tell us more (optional)" rows={2} />
              <Button className="mt-2" disabled={!csatScore || csatMutation.isPending} onClick={() => csatMutation.mutate()} data-testid="button-submit-csat">
                Submit feedback
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
