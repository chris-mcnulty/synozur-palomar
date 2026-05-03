import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Save, Trash2, Loader2 } from "lucide-react";
import type { SystemSetting } from "@shared/schema";

const settingSchema = z.object({
  settingKey: z.string().min(1, "Key is required"),
  settingValue: z.string(),
  description: z.string().optional(),
  settingType: z.enum(["string", "json", "boolean", "number"]).default("string"),
});
type SettingForm = z.infer<typeof settingSchema>;

export default function SystemSettings() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<SystemSetting | null>(null);

  const { data: settings = [], isLoading } = useQuery<SystemSetting[]>({
    queryKey: ["/api/settings"],
  });

  const form = useForm<SettingForm>({
    resolver: zodResolver(settingSchema),
    defaultValues: {
      settingKey: "",
      settingValue: "",
      description: "",
      settingType: "string",
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: SettingForm) => {
      return apiRequest("POST", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Setting saved" });
      form.reset();
      setEditing(null);
    },
    onError: (err: any) =>
      toast({ title: "Save failed", description: err?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/settings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Setting deleted" });
    },
    onError: (err: any) =>
      toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
  });

  const onSubmit = (data: SettingForm) => upsertMutation.mutate(data);

  const startEdit = (s: SystemSetting) => {
    setEditing(s);
    form.reset({
      settingKey: s.settingKey,
      settingValue: s.settingValue ?? "",
      description: s.description ?? "",
      settingType: (s.settingType as any) ?? "string",
    });
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">System Settings</h1>
          <p className="text-muted-foreground">
            Platform-wide configuration values. Stored as key/value pairs.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{editing ? `Edit: ${editing.settingKey}` : "Create / Update Setting"}</CardTitle>
            <CardDescription>
              Setting keys are unique. Posting an existing key will update its value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="settingKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!!editing} data-testid="input-setting-key" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="settingValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} data-testid="input-setting-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} data-testid="input-setting-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={upsertMutation.isPending} data-testid="button-save-setting">
                    {upsertMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save
                  </Button>
                  {editing && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditing(null);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Settings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : settings.length === 0 ? (
              <div className="text-sm text-muted-foreground">No settings configured.</div>
            ) : (
              <div className="divide-y">
                {settings.map((s) => (
                  <div key={s.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-medium">{s.settingKey}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.settingValue}</div>
                      {s.description && (
                        <div className="text-xs text-muted-foreground mt-1">{s.description}</div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(s)}
                        data-testid={`button-edit-${s.settingKey}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(s.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${s.settingKey}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
