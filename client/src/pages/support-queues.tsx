import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit2, Trash2, Users, Loader2 } from "lucide-react";
import type { SupportQueue } from "@shared/schema";

interface UserLite {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
}
interface QueueMember {
  id: string;
  queueId: string;
  userId: string;
  user: UserLite | null;
}
function fullName(u: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined) {
  if (!u) return "Unknown";
  const n = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  return n || u.email || "Unknown";
}

const formSchema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  emailAlias: z.string().email().optional().or(z.literal("")),
  defaultAssigneeId: z.string().optional(),
  escalationContactEmail: z.string().email().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
type FormValues = z.infer<typeof formSchema>;

export default function SupportQueuesAdmin() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<SupportQueue | null>(null);
  const [creating, setCreating] = useState(false);
  const [memberQueueId, setMemberQueueId] = useState<string | null>(null);

  const { data: queues = [], isLoading } = useQuery<SupportQueue[]>({ queryKey: ["/api/support/queues"] });
  const { data: users = [] } = useQuery<UserLite[]>({ queryKey: ["/api/users"] });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", emailAlias: "", defaultAssigneeId: "", escalationContactEmail: "", isActive: true, sortOrder: 0 },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: "", description: "", emailAlias: "", defaultAssigneeId: "", escalationContactEmail: "", isActive: true, sortOrder: 0 });
    setCreating(true);
  };
  const openEdit = (q: SupportQueue) => {
    setEditing(q);
    form.reset({
      name: q.name,
      description: q.description || "",
      emailAlias: q.emailAlias || "",
      defaultAssigneeId: q.defaultAssigneeId || "",
      escalationContactEmail: q.escalationContactEmail || "",
      isActive: q.isActive,
      sortOrder: q.sortOrder,
    });
    setCreating(true);
  };

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        description: values.description || null,
        emailAlias: values.emailAlias || null,
        defaultAssigneeId: values.defaultAssigneeId || null,
        escalationContactEmail: values.escalationContactEmail || null,
      };
      if (editing) {
        return apiRequest(`/api/support/queues/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      return apiRequest("/api/support/queues", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast({ title: editing ? "Queue updated" : "Queue created" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/queues"] });
      setCreating(false);
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/support/queues/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Queue deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/queues"] });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-4" data-testid="page-support-queues">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Support Queues</h1>
            <p className="text-sm text-muted-foreground">Define routing groups and the agents who pick up their tickets.</p>
          </div>
          <Button onClick={openCreate} data-testid="button-new-queue"><Plus className="h-4 w-4 mr-1" />New queue</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : queues.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No queues yet. Create one to start routing tickets.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Email alias</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queues.map((q) => {
                    const lead = users.find((u) => u.id === q.defaultAssigneeId);
                    return (
                      <TableRow key={q.id} data-testid={`row-queue-${q.id}`}>
                        <TableCell className="font-medium">{q.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{q.description || "—"}</TableCell>
                        <TableCell className="text-sm">{q.emailAlias || "—"}</TableCell>
                        <TableCell className="text-sm">{lead ? fullName(lead) : "—"}</TableCell>
                        <TableCell>{q.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => setMemberQueueId(q.id)} data-testid={`button-members-${q.id}`}>
                            <Users className="h-4 w-4 mr-1" />Members
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(q)} data-testid={`button-edit-queue-${q.id}`}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" data-testid={`button-delete-queue-${q.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete queue?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tickets currently in "{q.name}" will be unlinked. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove.mutate(q.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit queue" : "New queue"}</DialogTitle>
            <DialogDescription>Routing group for tickets. Add members below to enable auto-assignment.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-queue-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea rows={2} {...field} value={field.value || ""} data-testid="input-queue-description" /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="emailAlias" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email alias</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} placeholder="support+queue@…" data-testid="input-queue-email-alias" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="escalationContactEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Escalation email</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} data-testid="input-queue-escalation" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="defaultAssigneeId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Queue lead (default assignee fallback)</FormLabel>
                  <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                    <FormControl><SelectTrigger data-testid="select-queue-lead"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {users.filter(u => u.isActive).map(u => <SelectItem key={u.id} value={u.id}>{fullName(u)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="sortOrder" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort order</FormLabel>
                    <FormControl><Input type="number" {...field} data-testid="input-queue-sort" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded border p-3 mt-6">
                    <FormLabel className="m-0">Active</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-queue-active" /></FormControl>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                <Button type="submit" disabled={save.isPending} data-testid="button-save-queue">
                  {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {editing ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <MembersDialog queueId={memberQueueId} onClose={() => setMemberQueueId(null)} users={users} />
    </Layout>
  );
}

function MembersDialog({ queueId, onClose, users }: { queueId: string | null; onClose: () => void; users: UserLite[] }) {
  const { toast } = useToast();
  const { data: members = [], isLoading } = useQuery<QueueMember[]>({
    queryKey: ["/api/support/queues", queueId, "members"],
    enabled: !!queueId,
  });
  const memberIds = new Set(members.map((m) => m.userId));

  const setMembers = useMutation({
    mutationFn: async (userIds: string[]) =>
      apiRequest(`/api/support/queues/${queueId}/members`, {
        method: "PUT",
        body: JSON.stringify({ userIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/queues", queueId, "members"] });
      toast({ title: "Members updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const toggle = (userId: string, checked: boolean) => {
    const next = checked ? [...Array.from(memberIds), userId] : Array.from(memberIds).filter((id) => id !== userId);
    setMembers.mutate(Array.from(new Set(next)));
  };

  return (
    <Dialog open={!!queueId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Queue members</DialogTitle>
          <DialogDescription>Members are eligible for least-loaded auto-assignment when tickets land in this queue.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {users.filter(u => u.isActive).map((u) => (
              <label key={u.id} className="flex items-center gap-2 rounded p-2 hover-elevate cursor-pointer" data-testid={`row-member-${u.id}`}>
                <Checkbox
                  checked={memberIds.has(u.id)}
                  onCheckedChange={(c) => toggle(u.id, !!c)}
                  data-testid={`checkbox-member-${u.id}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{fullName(u)}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
              </label>
            ))}
            {users.filter(u => u.isActive).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No active users.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
