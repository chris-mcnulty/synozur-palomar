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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Mail, Plus, RefreshCw, Trash2, Loader2, AlertTriangle } from "lucide-react";
import type { SupportEmailSubscription } from "@shared/schema";

const formSchema = z.object({
  mailbox: z.string().email("Enter a valid mailbox address"),
  azureTenantId: z.string().optional(),
  lifetimeMinutes: z.coerce.number().int().min(15).max(4230).optional(),
});
type FormValues = z.infer<typeof formSchema>;

function formatExpiry(iso: string | Date): { label: string; tone: "ok" | "warn" | "expired" } {
  const exp = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((exp - now) / 60000);
  if (diffMin <= 0) return { label: `Expired ${new Date(iso).toLocaleString()}`, tone: "expired" };
  const tone = diffMin < 30 ? "warn" : "ok";
  if (diffMin < 60) return { label: `Expires in ${diffMin} min (${new Date(iso).toLocaleTimeString()})`, tone };
  const hours = Math.round(diffMin / 60);
  if (hours < 48) return { label: `Expires in ${hours} h (${new Date(iso).toLocaleString()})`, tone };
  const days = Math.round(hours / 24);
  return { label: `Expires in ${days} d (${new Date(iso).toLocaleString()})`, tone };
}

export default function SupportEmailSubscriptionsAdmin() {
  const { toast } = useToast();
  const [createError, setCreateError] = useState<string | null>(null);

  const subsQuery = useQuery<SupportEmailSubscription[]>({
    queryKey: ["/api/support/graph/subscriptions"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { mailbox: "", azureTenantId: "", lifetimeMinutes: 60 },
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: Record<string, unknown> = { mailbox: values.mailbox };
      if (values.azureTenantId) payload.azureTenantId = values.azureTenantId;
      if (values.lifetimeMinutes) payload.lifetimeMinutes = values.lifetimeMinutes;
      return apiRequest("/api/support/graph/subscriptions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setCreateError(null);
      toast({ title: "Mailbox subscription created" });
      form.reset({ mailbox: "", azureTenantId: "", lifetimeMinutes: 60 });
      queryClient.invalidateQueries({ queryKey: ["/api/support/graph/subscriptions"] });
    },
    onError: (e: Error) => {
      setCreateError(e.message);
      toast({ title: "Failed to create subscription", description: e.message, variant: "destructive" });
    },
  });

  const renew = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/api/support/graph/subscriptions/${id}/renew`, {
        method: "POST",
        body: JSON.stringify({ lifetimeMinutes: 60 }),
      }),
    onSuccess: () => {
      toast({ title: "Subscription renewed" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/graph/subscriptions"] });
    },
    onError: (e: Error) => toast({ title: "Renew failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/api/support/graph/subscriptions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Subscription deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/graph/subscriptions"] });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const subs = subsQuery.data || [];

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-6" data-testid="page-support-email-subscriptions">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5" /> Support Mailbox Subscriptions
          </h1>
          <p className="text-sm text-muted-foreground">
            Wire a shared Microsoft 365 mailbox (e.g. <code>Constellation@synozur.com</code>) into the
            ticket inbox. Inbound mail will be turned into tickets automatically.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active subscriptions</CardTitle>
            <CardDescription>
              Microsoft Graph subscriptions expire — they are auto-renewed in the background, but you
              can renew or remove them manually here.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {subsQuery.isLoading ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : subsQuery.isError ? (
              <div className="p-6">
                <Alert variant="destructive" data-testid="alert-list-error">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Could not load subscriptions</AlertTitle>
                  <AlertDescription className="break-words">
                    {(subsQuery.error as Error)?.message || "Unknown error"}
                  </AlertDescription>
                </Alert>
              </div>
            ) : subs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No mailbox subscriptions yet. Create one below to start ingesting email.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mailbox</TableHead>
                    <TableHead>Azure tenant</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Subscription ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => {
                    const exp = formatExpiry(s.expiresAt);
                    return (
                      <TableRow key={s.id} data-testid={`row-mailbox-sub-${s.id}`}>
                        <TableCell className="font-medium" data-testid={`text-mailbox-${s.id}`}>{s.mailbox}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{s.azureTenantId}</TableCell>
                        <TableCell>
                          <Badge
                            variant={exp.tone === "expired" ? "destructive" : exp.tone === "warn" ? "secondary" : "default"}
                            data-testid={`badge-expiry-${s.id}`}
                          >
                            {exp.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{s.id}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={renew.isPending}
                            onClick={() => renew.mutate(s.id)}
                            data-testid={`button-renew-${s.id}`}
                          >
                            <RefreshCw className={`h-4 w-4 mr-1 ${renew.isPending && renew.variables === s.id ? "animate-spin" : ""}`} />
                            Renew
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={remove.isPending && remove.variables === s.id}
                                data-testid={`button-delete-${s.id}`}
                              >
                                {remove.isPending && remove.variables === s.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove mailbox subscription?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Inbound email to <strong>{s.mailbox}</strong> will no longer create
                                  or update tickets. You can re-subscribe later.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove.mutate(s.id)}>Delete</AlertDialogAction>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscribe a new mailbox</CardTitle>
            <CardDescription>
              The Azure app registration needs <code>Mail.Read</code> application permission on the
              target tenant, and the mailbox must exist in that tenant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {createError && (
              <Alert variant="destructive" className="mb-4" data-testid="alert-create-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not create subscription</AlertTitle>
                <AlertDescription className="break-words">
                  {createError}
                  {/Mail\.Read|permission|Forbidden|403/i.test(createError) && (
                    <div className="mt-2 text-xs">
                      Tip: grant the <strong>Mail.Read</strong> application permission to the
                      Azure app registration in the target tenant and admin-consent it.
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((v) => create.mutate(v))}
                className="space-y-4 max-w-xl"
              >
                <FormField
                  control={form.control}
                  name="mailbox"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mailbox address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Constellation@synozur.com"
                          {...field}
                          data-testid="input-mailbox"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="azureTenantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Azure tenant ID <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Leave blank to use the tenant's configured Azure tenant ID"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-azure-tenant"
                        />
                      </FormControl>
                      <FormDescription>Override only if the mailbox lives in a different Azure tenant.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lifetimeMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lifetime (minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={15}
                          max={4230}
                          {...field}
                          data-testid="input-lifetime"
                        />
                      </FormControl>
                      <FormDescription>Graph caps mail subscriptions at 4230 minutes (~70 hours). Auto-renew runs in the background.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={create.isPending} data-testid="button-create-subscription">
                  {create.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Create subscription
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
