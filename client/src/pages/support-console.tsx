import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Send, Inbox, AlertTriangle, Clock, Hourglass, CheckCircle2, UserCheck,
  Users, Activity, BookOpen, Lock, Eye, Plus, X, Search, Hand, Bookmark, Pin, Trash2, Save,
} from "lucide-react";

interface SavedFilter {
  id: string;
  name: string;
  query: Record<string, string>;
  isPinned: boolean;
  sortOrder: number;
}

const SAVED_VIEWS = [
  { key: "my-open", label: "My open", icon: UserCheck },
  { key: "my-queues", label: "My queues", icon: Users },
  { key: "unassigned", label: "Unassigned", icon: Inbox },
  { key: "breaching", label: "Breaching in 1h", icon: AlertTriangle },
  { key: "awaiting", label: "Awaiting customer", icon: Hourglass },
  { key: "closed-today", label: "Closed today", icon: CheckCircle2 },
] as const;

type ViewKey = typeof SAVED_VIEWS[number]["key"] | "queue";

interface Ticket {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  ticketType: string;
  queueId: string | null;
  assignedTo: string | null;
  slaBreached: boolean;
  resolutionDueAt: string | null;
  firstResponseDueAt: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  externalRequesterEmail: string | null;
  externalRequesterName: string | null;
  tenantId: string | null;
}

interface TicketDetail extends Ticket {
  replies: Reply[];
  author: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  tenant: { id: string; name: string } | null;
  assignee: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  watchers: Watcher[];
  activity: ActivityRow[];
}

interface Reply {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
}

interface Watcher {
  id: string;
  userId: string | null;
  externalEmail: string | null;
  user: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
}

interface ActivityRow {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  createdAt: string;
  actor: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
}

interface Queue {
  id: string;
  name: string;
  description: string | null;
}

interface UserLite {
  id: string;
  name: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
}

interface KbArticle {
  id: string;
  title: string;
  summary: string | null;
  visibility: string;
  publishedAt: string | null;
  updatedAt: string;
}

const TICKET_STATUSES = ['new', 'open', 'in_progress', 'pending', 'on_hold', 'resolved', 'closed', 'cancelled'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const TICKET_TYPES = ['incident', 'service_request', 'problem', 'change', 'question'] as const;

function fmtLabel(v: string | null | undefined) {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function relTime(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d`;
  return d.toLocaleDateString();
}

function fullName(u: { firstName?: string | null; lastName?: string | null; email?: string | null; name?: string | null } | null | undefined) {
  if (!u) return "Unassigned";
  const n = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return n || u.name || u.email || "Unassigned";
}

function priorityClass(p: string) {
  if (p === 'critical') return "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200 border-transparent";
  if (p === 'high') return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 border-transparent";
  if (p === 'medium') return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 border-transparent";
  return "bg-muted text-muted-foreground border-transparent";
}

function statusClass(s: string) {
  switch (s) {
    case 'new': return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 border-transparent";
    case 'open': return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border-transparent";
    case 'in_progress': return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border-transparent";
    case 'pending':
    case 'on_hold': return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200 border-transparent";
    case 'resolved': return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-transparent";
    default: return "bg-muted text-muted-foreground border-transparent";
  }
}

function ageOf(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h`;
  const m = Math.floor(diff / 60000);
  return `${m}m`;
}

function slaIndicator(t: Ticket) {
  if (t.slaBreached) return { color: "text-red-600 dark:text-red-400", label: "Breached" };
  if (!t.resolutionDueAt) return null;
  const ms = new Date(t.resolutionDueAt).getTime() - Date.now();
  if (ms < 0) return { color: "text-red-600 dark:text-red-400", label: "Breached" };
  if (ms < 60 * 60 * 1000) return { color: "text-orange-600 dark:text-orange-400", label: "<1h" };
  if (ms < 4 * 60 * 60 * 1000) return { color: "text-amber-600 dark:text-amber-400", label: "<4h" };
  return { color: "text-muted-foreground", label: `${Math.floor(ms / 3600000)}h` };
}

function SavedViews({
  selectedView,
  onSelect,
  selectedQueueId,
  onSelectQueue,
  queues,
  counts,
  savedFilters,
  selectedSavedFilterId,
  onSelectSavedFilter,
  onDeleteSavedFilter,
  onSaveCurrent,
  canSaveCurrent,
}: {
  selectedView: ViewKey;
  onSelect: (v: ViewKey) => void;
  selectedQueueId: string | null;
  onSelectQueue: (id: string | null) => void;
  queues: Queue[];
  counts: Record<string, number>;
  savedFilters: SavedFilter[];
  selectedSavedFilterId: string | null;
  onSelectSavedFilter: (f: SavedFilter) => void;
  onDeleteSavedFilter: (id: string) => void;
  onSaveCurrent: () => void;
  canSaveCurrent: boolean;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
          Saved views
        </div>
        {SAVED_VIEWS.map((v) => {
          const Icon = v.icon;
          const isActive = selectedView === v.key && !selectedQueueId;
          return (
            <button
              key={v.key}
              onClick={() => { onSelect(v.key); onSelectQueue(null); }}
              data-testid={`view-${v.key}`}
              className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover-elevate text-left ${
                isActive ? "bg-accent text-accent-foreground" : "text-foreground"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{v.label}</span>
              </span>
              {counts[v.key] != null && (
                <Badge variant="secondary" className="text-xs">{counts[v.key]}</Badge>
              )}
            </button>
          );
        })}

        <Separator className="my-2" />
        <div className="flex items-center justify-between px-2 py-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">My filters</div>
          <button
            onClick={onSaveCurrent}
            disabled={!canSaveCurrent}
            data-testid="button-save-filter"
            title="Save the current search/view as a personal filter"
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Save className="h-3 w-3" /> Save
          </button>
        </div>
        {savedFilters.length === 0 && (
          <div className="text-xs text-muted-foreground px-2 py-1">No saved filters yet.</div>
        )}
        {savedFilters.map((f) => {
          const isActive = selectedSavedFilterId === f.id;
          return (
            <div key={f.id} className={`group flex items-center gap-1 rounded-md ${isActive ? "bg-accent text-accent-foreground" : ""}`}>
              <button
                onClick={() => onSelectSavedFilter(f)}
                data-testid={`saved-filter-${f.id}`}
                className="flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover-elevate text-left min-w-0"
              >
                {f.isPinned ? <Pin className="h-3.5 w-3.5 shrink-0" /> : <Bookmark className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{f.name}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSavedFilter(f.id); }}
                data-testid={`delete-saved-filter-${f.id}`}
                className="opacity-0 group-hover:opacity-100 px-1 text-muted-foreground hover:text-destructive"
                title="Delete filter"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {queues.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
              Queues
            </div>
            {queues.map((q) => (
              <button
                key={q.id}
                onClick={() => { onSelectQueue(q.id); onSelect("queue"); }}
                data-testid={`queue-${q.id}`}
                className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover-elevate text-left ${
                  selectedQueueId === q.id ? "bg-accent text-accent-foreground" : "text-foreground"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="truncate">{q.name}</span>
                </span>
                {counts[`queue:${q.id}`] != null && (
                  <Badge variant="secondary" className="text-xs">{counts[`queue:${q.id}`]}</Badge>
                )}
              </button>
            ))}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function TicketTable({
  tickets,
  selectedId,
  onSelect,
  isLoading,
  queues,
  users,
  search,
  onSearchChange,
}: {
  tickets: Ticket[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  queues: Queue[];
  users: UserLite[];
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const queueMap = useMemo(() => new Map(queues.map((q) => [q.id, q.name])), [queues]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  type SortKey = "updated" | "created" | "priority";
  const [sortBy, setSortBy] = useState<SortKey>("updated");

  const sorted = useMemo(() => {
    const list = [...tickets];
    if (sortBy === "priority") {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      list.sort((a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99));
    } else if (sortBy === "created") {
      list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    } else {
      list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    }
    return list;
  }, [tickets, sortBy]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-2 flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search subject or description"
            className="pl-7 h-8 text-sm"
            data-testid="input-console-search"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="h-8 w-[140px] text-xs" data-testid="select-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="created">Newest</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
          <Inbox className="h-10 w-10 mb-2 opacity-50" />
          No tickets in this view.
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <table className="w-full text-sm" data-testid="table-console-tickets">
            <thead className="sticky top-0 bg-background border-b text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium p-2 w-[60px]">#</th>
                <th className="text-left font-medium p-2">Subject</th>
                <th className="text-left font-medium p-2 w-[140px]">Requester</th>
                <th className="text-left font-medium p-2 w-[120px]">Queue</th>
                <th className="text-left font-medium p-2 w-[90px]">Priority</th>
                <th className="text-left font-medium p-2 w-[110px]">Status</th>
                <th className="text-left font-medium p-2 w-[60px]">Age</th>
                <th className="text-left font-medium p-2 w-[80px]">SLA</th>
                <th className="text-left font-medium p-2 w-[140px]">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const sla = slaIndicator(t);
                const isSel = selectedId === t.id;
                const requester = t.userId ? userMap.get(t.userId) : null;
                const requesterName = requester
                  ? fullName(requester)
                  : (t.externalRequesterName || t.externalRequesterEmail || "—");
                const assignee = t.assignedTo ? userMap.get(t.assignedTo) : null;
                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    data-testid={`row-ticket-${t.id}`}
                    className={`border-b cursor-pointer hover-elevate ${isSel ? "bg-accent/50" : ""}`}
                  >
                    <td className="p-2 font-mono text-xs text-muted-foreground">#{t.ticketNumber}</td>
                    <td className="p-2 max-w-[400px]">
                      <div className="truncate font-medium">{t.subject}</div>
                    </td>
                    <td className="p-2 truncate text-xs">{requesterName}</td>
                    <td className="p-2 truncate text-xs text-muted-foreground">
                      {t.queueId ? queueMap.get(t.queueId) || "—" : "—"}
                    </td>
                    <td className="p-2">
                      <Badge className={`text-xs ${priorityClass(t.priority)}`}>{fmtLabel(t.priority)}</Badge>
                    </td>
                    <td className="p-2">
                      <Badge className={`text-xs ${statusClass(t.status)}`}>{fmtLabel(t.status)}</Badge>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{ageOf(t.createdAt)}</td>
                    <td className={`p-2 text-xs font-medium ${sla?.color || "text-muted-foreground"}`}>
                      {sla?.label || "—"}
                    </td>
                    <td className="p-2 truncate text-xs">{assignee ? fullName(assignee) : <span className="text-muted-foreground italic">Unassigned</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
}

function TicketDetailPane({
  ticketId,
  queues,
  users,
}: {
  ticketId: string;
  queues: Queue[];
  users: UserLite[];
}) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [replyText, setReplyText] = useState("");
  const [replyMode, setReplyMode] = useState<"public" | "internal">("public");
  const [showInternalNotes, setShowInternalNotes] = useState(true);
  const [watcherEmail, setWatcherEmail] = useState("");

  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: ["/api/support/tickets", ticketId],
  });

  type TicketUpdates = {
    status?: string;
    priority?: string;
    assignedTo?: string | null;
    queueId?: string | null;
    ticketType?: string;
    category?: string;
    subject?: string;
    description?: string;
  };
  const updateTicket = useMutation({
    mutationFn: async (updates: TicketUpdates) => {
      return await apiRequest(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/support/tickets/${ticketId}/replies`, {
        method: "POST",
        body: JSON.stringify({ message: replyText.trim(), isInternal: replyMode === "internal" }),
      });
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
    },
    onError: (e: Error) => toast({ title: "Reply failed", description: e.message, variant: "destructive" }),
  });

  const addWatcher = useMutation({
    mutationFn: async (input: { userId?: string; externalEmail?: string }) => {
      return await apiRequest(`/api/support/tickets/${ticketId}/watchers`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      setWatcherEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId] });
    },
    onError: (e: Error) => toast({ title: "Failed to add watcher", description: e.message, variant: "destructive" }),
  });

  const removeWatcher = useMutation({
    mutationFn: async (watcherId: string) => {
      return await apiRequest(`/api/support/watchers/${watcherId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId] });
    },
  });

  if (isLoading || !ticket) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const visibleReplies = showInternalNotes ? ticket.replies : ticket.replies.filter((r) => !r.isInternal);
  const requesterDisplay = ticket.author
    ? `${fullName(ticket.author)} <${ticket.author.email}>`
    : (ticket.externalRequesterEmail
        ? `${ticket.externalRequesterName || ''} <${ticket.externalRequesterEmail}>`.trim()
        : "Unknown");

  const sla = slaIndicator(ticket);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-3 shrink-0 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">#{ticket.ticketNumber}</span>
              <span>•</span>
              <span>{requesterDisplay}</span>
              {ticket.tenant && <><span>•</span><span>{ticket.tenant.name}</span></>}
            </div>
            <h2 className="text-base font-semibold mt-0.5 truncate" data-testid="text-console-detail-subject">
              {ticket.subject}
            </h2>
          </div>
          {sla && (
            <div className={`flex items-center gap-1 text-xs font-medium ${sla.color}`}>
              <Clock className="h-3.5 w-3.5" />
              SLA {sla.label}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <Select value={ticket.status} onValueChange={(v) => updateTicket.mutate({ status: v })}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-detail-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{fmtLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ticket.priority} onValueChange={(v) => updateTicket.mutate({ priority: v })}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-detail-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{fmtLabel(p)}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Select
              value={ticket.assignedTo || "__unassigned__"}
              onValueChange={(v) => updateTicket.mutate({ assignedTo: v === "__unassigned__" ? null : v })}
            >
              <SelectTrigger className="h-8 text-xs flex-1" data-testid="select-detail-assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {users.filter((u) => u.isActive).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{fullName(u)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentUser && ticket.assignedTo !== currentUser.id && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2"
                onClick={() => updateTicket.mutate({ assignedTo: currentUser.id })}
                disabled={updateTicket.isPending}
                title="Take this ticket"
                data-testid="button-take-ticket"
              >
                <Hand className="h-3.5 w-3.5 mr-1" />Take
              </Button>
            )}
            {currentUser && ticket.assignedTo === currentUser.id && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2"
                onClick={() => updateTicket.mutate({ assignedTo: null })}
                disabled={updateTicket.isPending}
                title="Reassign / release"
                data-testid="button-release-ticket"
              >
                <X className="h-3.5 w-3.5 mr-1" />Release
              </Button>
            )}
          </div>
          <Select
            value={ticket.queueId || "__none__"}
            onValueChange={(v) => updateTicket.mutate({ queueId: v === "__none__" ? null : v })}
          >
            <SelectTrigger className="h-8 text-xs" data-testid="select-detail-queue">
              <SelectValue placeholder="Queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No queue</SelectItem>
              {queues.map((q) => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ticket.ticketType} onValueChange={(v) => updateTicket.mutate({ ticketType: v })}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-detail-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_TYPES.map((t) => <SelectItem key={t} value={t}>{fmtLabel(t)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground mb-1">
                {fullName(ticket.author)} • {relTime(ticket.createdAt)}
              </div>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Conversation</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInternalNotes((v) => !v)}
              data-testid="button-toggle-internal-notes"
            >
              {showInternalNotes ? <Eye className="h-3.5 w-3.5 mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
              {showInternalNotes ? "Hide internal" : "Show internal"}
            </Button>
          </div>

          {visibleReplies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No replies yet.</p>
          ) : (
            <div className="space-y-2">
              {visibleReplies.map((r) => (
                <Card key={r.id} className={r.isInternal ? "border-amber-300 bg-amber-50/40 dark:bg-amber-900/10" : ""} data-testid={`reply-${r.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-xs">
                          {fullName(r.user).split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{fullName(r.user)}</span>
                          <span>{relTime(r.createdAt)}</span>
                          {r.isInternal && <Badge variant="outline" className="text-[10px] h-4 border-amber-400 text-amber-700 dark:text-amber-300"><Lock className="h-2.5 w-2.5 mr-0.5" />Internal</Badge>}
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{r.message}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div>
            <Tabs value={replyMode} onValueChange={(v) => setReplyMode(v as "public" | "internal")}>
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="public" className="text-xs" data-testid="tab-reply-public">
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Public reply
                </TabsTrigger>
                <TabsTrigger value="internal" className="text-xs" data-testid="tab-reply-internal">
                  <Lock className="h-3.5 w-3.5 mr-1" />
                  Internal note
                </TabsTrigger>
              </TabsList>
              <TabsContent value="public" className="mt-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply to requester (will email them)"
                  className="min-h-[90px]"
                  data-testid="input-reply-public"
                />
              </TabsContent>
              <TabsContent value="internal" className="mt-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Internal note — visible only to staff"
                  className="min-h-[90px] border-amber-300 bg-amber-50/40 dark:bg-amber-900/10"
                  data-testid="input-reply-internal"
                />
              </TabsContent>
            </Tabs>
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                onClick={() => sendReply.mutate()}
                disabled={!replyText.trim() || sendReply.isPending}
                data-testid="button-send-console-reply"
              >
                {sendReply.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                {replyMode === "internal" ? "Add note" : "Send reply"}
              </Button>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Watchers ({ticket.watchers.length})
            </h3>
            <div className="space-y-1">
              {ticket.watchers.map((w) => (
                <div key={w.id} className="flex items-center justify-between text-xs rounded border px-2 py-1" data-testid={`watcher-${w.id}`}>
                  <span className="truncate">{w.user ? `${fullName(w.user)} <${w.user.email}>` : w.externalEmail}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeWatcher.mutate(w.id)} data-testid={`button-remove-watcher-${w.id}`}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {ticket.watchers.length === 0 && (
                <p className="text-xs text-muted-foreground">No watchers.</p>
              )}
              <div className="flex gap-1 pt-1">
                <Input
                  value={watcherEmail}
                  onChange={(e) => setWatcherEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="h-7 text-xs"
                  data-testid="input-add-watcher"
                />
                <Select onValueChange={(userId) => addWatcher.mutate({ userId })}>
                  <SelectTrigger className="h-7 w-[120px] text-xs">
                    <SelectValue placeholder="Or pick user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => u.isActive).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{fullName(u)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={!watcherEmail.trim() || addWatcher.isPending}
                  onClick={() => addWatcher.mutate({ externalEmail: watcherEmail.trim() })}
                  data-testid="button-add-watcher"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Activity
            </h3>
            {ticket.activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-1.5">
                {ticket.activity.slice().reverse().map((a) => (
                  <div key={a.id} className="text-xs text-muted-foreground flex items-start gap-2" data-testid={`activity-${a.id}`}>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <span className="text-foreground">{a.actor ? fullName(a.actor) : "System"}</span>
                      {" "}{fmtLabel(a.action).toLowerCase()}
                      {a.fieldName && a.newValue && (
                        <> {a.fieldName} → <span className="text-foreground">{a.newValue}</span></>
                      )}
                      {a.note && <> — {a.note}</>}
                      <span className="ml-1">• {relTime(a.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function RelatedKbSidebar({ subject, description, tenantId }: { subject: string | null; description?: string | null; tenantId?: string | null }) {
  // Build a search term from subject + meaningful keywords from description
  const searchTerm = useMemo(() => {
    if (!subject) return "";
    const desc = (description || "").trim();
    if (!desc) return subject;
    const keywords = desc
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 8)
      .join(" ");
    return `${subject} ${keywords}`.trim();
  }, [subject, description]);

  const { data: articles, isLoading } = useQuery<KbArticle[]>({
    queryKey: ["/api/support/kb", { q: searchTerm, published: true, visibility: "internal", limit: 3, tenantId: tenantId || undefined }],
    queryFn: async () => {
      if (!searchTerm) return [];
      const params = new URLSearchParams({
        q: searchTerm,
        published: "true",
        visibility: "internal",
        limit: "3",
      });
      if (tenantId) params.set("tenantId", tenantId);
      const r = await fetch(`/api/support/kb?${params.toString()}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!searchTerm,
  });

  const top = (articles || []).slice(0, 3);

  return (
    <div className="flex flex-col h-full border-l">
      <div className="border-b p-3 shrink-0">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" /> Related KB
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Top matches from your knowledge base.</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {!subject && <p className="text-xs text-muted-foreground">Select a ticket to see suggestions.</p>}
          {subject && isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {subject && !isLoading && top.length === 0 && (
            <p className="text-xs text-muted-foreground">No matching articles.</p>
          )}
          {top.map((a) => (
            <Card key={a.id} data-testid={`kb-${a.id}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Badge variant="outline" className="text-[10px] h-4">{fmtLabel(a.visibility)}</Badge>
                  {a.publishedAt && <Badge variant="secondary" className="text-[10px] h-4">Published</Badge>}
                </div>
                <div className="text-sm font-medium">{a.title}</div>
                {a.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{a.summary}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function SupportConsole() {
  const { user, isLoading: authLoading, hasAnyRole, isPlatformAdmin } = useAuth();
  const [view, setView] = useState<ViewKey>("my-open");
  const [queueId, setQueueId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedSavedFilterId, setSelectedSavedFilterId] = useState<string | null>(null);
  const { toast } = useToast();

  const isStaff = !!user && (isPlatformAdmin || hasAnyRole(['admin', 'billing-admin']));

  const { data: savedFilters = [] } = useQuery<SavedFilter[]>({
    queryKey: ["/api/support/saved-filters"],
    enabled: isStaff,
  });

  const createSavedFilter = useMutation({
    mutationFn: async (input: { name: string; query: Record<string, string> }) => {
      return apiRequest("/api/support/saved-filters", { method: "POST", body: JSON.stringify(input) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/saved-filters"] });
      toast({ title: "Filter saved" });
    },
    onError: () => toast({ title: "Couldn't save filter", variant: "destructive" }),
  });

  const deleteSavedFilter = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/support/saved-filters/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/saved-filters"] });
    },
  });

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (queueId) {
      p.set("queueId", queueId);
      p.set("status", "open");
      p.set("includeInProgress", "true");
    } else {
      p.set("view", view);
    }
    if (search.trim()) p.set("search", search.trim());
    return p.toString();
  }, [view, queueId, search]);

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/support/tickets", queryParams],
    queryFn: async () => {
      const r = await fetch(`/api/support/tickets?${queryParams}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load tickets");
      return r.json();
    },
    enabled: isStaff,
  });

  const { data: queues = [] } = useQuery<Queue[]>({
    queryKey: ["/api/support/queues"],
    enabled: isStaff,
  });

  const { data: users = [] } = useQuery<UserLite[]>({
    queryKey: ["/api/users"],
    enabled: isStaff,
  });

  // Build counts for each saved view via lightweight fetches
  const { data: counts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/support/tickets", "counts", queues.map((q) => q.id).join(",")],
    queryFn: async () => {
      const result: Record<string, number> = {};
      const fetches = SAVED_VIEWS.map((v) =>
        fetch(`/api/support/tickets?view=${v.key}`, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : []))
          .then((rows: unknown[]) => { result[v.key] = rows.length; })
          .catch(() => { result[v.key] = 0; })
      );
      const queueFetches = queues.map((q) =>
        fetch(`/api/support/tickets?queueId=${q.id}&includeInProgress=true&status=open`, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : []))
          .then((rows: unknown[]) => { result[`queue:${q.id}`] = rows.length; })
          .catch(() => { result[`queue:${q.id}`] = 0; })
      );
      await Promise.all([...fetches, ...queueFetches]);
      return result;
    },
    enabled: isStaff,
    staleTime: 30_000,
  });

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isStaff) {
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <Lock className="h-8 w-8 mx-auto mb-2 opacity-60" />
              The agent console is for support staff. Contact your administrator if you need access.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-9rem)] -m-4 lg:-m-6 flex" data-testid="page-support-console">
        <div className="w-[220px] border-r shrink-0 hidden md:block">
          <SavedViews
            selectedView={view}
            onSelect={(v) => { setView(v); setSelectedSavedFilterId(null); }}
            selectedQueueId={queueId}
            onSelectQueue={(id) => { setQueueId(id); setSelectedSavedFilterId(null); }}
            queues={queues}
            counts={counts}
            savedFilters={savedFilters}
            selectedSavedFilterId={selectedSavedFilterId}
            onSelectSavedFilter={(f) => {
              setSelectedSavedFilterId(f.id);
              if (typeof f.query.view === "string") setView(f.query.view as ViewKey);
              if (typeof f.query.queueId === "string") setQueueId(f.query.queueId);
              else setQueueId(null);
              setSearch(typeof f.query.search === "string" ? f.query.search : "");
            }}
            onDeleteSavedFilter={(id) => deleteSavedFilter.mutate(id)}
            onSaveCurrent={() => {
              const name = window.prompt("Name this saved filter");
              if (!name || !name.trim()) return;
              const query: Record<string, string> = { view, search };
              if (queueId) query.queueId = queueId;
              createSavedFilter.mutate({ name: name.trim(), query });
            }}
            canSaveCurrent={!!view || !!queueId || !!search.trim()}
          />
        </div>

        <div className="flex-1 min-w-0 flex">
          <div className={`${selectedTicketId ? "hidden lg:flex lg:w-[45%]" : "flex w-full"} flex-col border-r min-w-0`}>
            <TicketTable
              tickets={tickets}
              selectedId={selectedTicketId}
              onSelect={setSelectedTicketId}
              isLoading={ticketsLoading}
              queues={queues}
              users={users}
              search={search}
              onSearchChange={setSearch}
            />
          </div>

          {selectedTicketId && (
            <div className="flex-1 min-w-0 flex">
              <div className="flex-1 min-w-0">
                <TicketDetailPane
                  ticketId={selectedTicketId}
                  queues={queues}
                  users={users}
                />
              </div>
              <div className="w-[260px] shrink-0 hidden xl:block">
                <RelatedKbSidebar
                  subject={selectedTicket?.subject || null}
                  description={selectedTicket?.description || null}
                  tenantId={selectedTicket?.tenantId || null}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
