import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { TICKET_PRIORITIES, TICKET_TYPES, type SupportSlaPolicy } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1),
  priority: z.enum(TICKET_PRIORITIES),
  ticketType: z.string().optional(),
  firstResponseMinutes: z.coerce.number().int().min(1),
  resolutionMinutes: z.coerce.number().int().min(1),
  businessHoursOnly: z.boolean().default(false),
  bumpPriorityOnBreach: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
type FormValues = z.infer<typeof formSchema>;

export default function SupportSlaPoliciesAdmin() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<SupportSlaPolicy | null>(null);
  const [open, setOpen] = useState(false);

  const { data: policies = [], isLoading } = useQuery<SupportSlaPolicy[]>({ queryKey: ["/api/support/sla-policies"] });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", priority: "medium", ticketType: "", firstResponseMinutes: 60, resolutionMinutes: 1440, businessHoursOnly: false, bumpPriorityOnBreach: false, isActive: true },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: "", priority: "medium", ticketType: "", firstResponseMinutes: 60, resolutionMinutes: 1440, businessHoursOnly: false, bumpPriorityOnBreach: false, isActive: true });
    setOpen(true);
  };
  const openEdit = (p: SupportSlaPolicy) => {
    setEditing(p);
    form.reset({
      name: p.name,
      priority: p.priority as any,
      ticketType: p.ticketType || "",
      firstResponseMinutes: p.firstResponseMinutes,
      resolutionMinutes: p.resolutionMinutes,
      businessHoursOnly: p.businessHoursOnly,
      bumpPriorityOnBreach: p.bumpPriorityOnBreach,
      isActive: p.isActive,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, ticketType: values.ticketType || null };
      if (editing) return apiRequest(`/api/support/sla-policies/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      return apiRequest("/api/support/sla-policies", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast({ title: editing ? "Policy updated" : "Policy created" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/sla-policies"] });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/support/sla-policies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Policy deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/sla-policies"] });
    },
  });

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-4" data-testid="page-support-sla">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">SLA Policies</h1>
            <p className="text-sm text-muted-foreground">First-response and resolution targets applied when tickets are created.</p>
          </div>
          <Button onClick={openCreate} data-testid="button-new-sla"><Plus className="h-4 w-4 mr-1" />New policy</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : policies.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No SLA policies configured.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Ticket type</TableHead>
                    <TableHead>First response</TableHead>
                    <TableHead>Resolution</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p) => (
                    <TableRow key={p.id} data-testid={`row-sla-${p.id}`}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline">{p.priority}</Badge></TableCell>
                      <TableCell>{p.ticketType || <span className="text-muted-foreground">any</span>}</TableCell>
                      <TableCell>{p.firstResponseMinutes}m</TableCell>
                      <TableCell>{p.resolutionMinutes}m</TableCell>
                      <TableCell>{p.isActive ? <Badge>On</Badge> : <Badge variant="secondary">Off</Badge>}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-sla-${p.id}`}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" data-testid={`button-delete-sla-${p.id}`}><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete policy?</AlertDialogTitle>
                              <AlertDialogDescription>This won't change existing tickets, but new tickets will fall back to other policies.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove.mutate(p.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit policy" : "New SLA policy"}</DialogTitle>
            <DialogDescription>Targets are applied when a matching ticket is created.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-sla-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-sla-priority"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {TICKET_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="ticketType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket type</FormLabel>
                    <Select value={field.value || "__any__"} onValueChange={(v) => field.onChange(v === "__any__" ? "" : v)}>
                      <FormControl><SelectTrigger data-testid="select-sla-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__any__">Any</SelectItem>
                        {TICKET_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="firstResponseMinutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First response (min)</FormLabel>
                    <FormControl><Input type="number" {...field} data-testid="input-sla-first" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="resolutionMinutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution (min)</FormLabel>
                    <FormControl><Input type="number" {...field} data-testid="input-sla-resolution" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="businessHoursOnly" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded border p-2">
                    <FormLabel className="m-0 text-xs">Business hrs</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-sla-bh" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="bumpPriorityOnBreach" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded border p-2">
                    <FormLabel className="m-0 text-xs">Bump on breach</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-sla-bump" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded border p-2">
                    <FormLabel className="m-0 text-xs">Active</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-sla-active" /></FormControl>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={save.isPending} data-testid="button-save-sla">
                  {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {editing ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
