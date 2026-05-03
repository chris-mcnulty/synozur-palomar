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
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Loader2, BookOpen, Eye, Send } from "lucide-react";
import type { SupportKbArticle } from "@shared/schema";

const VISIBILITIES = ["internal", "public"] as const;

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200);
}

const formSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, dashes only"),
  summary: z.string().optional(),
  body: z.string().min(1),
  visibility: z.enum(VISIBILITIES),
  tags: z.string().optional(),
  publish: z.boolean().default(false),
});
type FormValues = z.infer<typeof formSchema>;

export default function SupportKbAdmin() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<SupportKbArticle | null>(null);
  const [open, setOpen] = useState(false);

  const { data: articles = [], isLoading } = useQuery<SupportKbArticle[]>({ queryKey: ["/api/support/kb"] });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", slug: "", summary: "", body: "", visibility: "internal", tags: "", publish: false },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ title: "", slug: "", summary: "", body: "", visibility: "internal", tags: "", publish: false });
    setOpen(true);
  };

  const openEdit = (a: SupportKbArticle) => {
    setEditing(a);
    form.reset({
      title: a.title,
      slug: a.slug,
      summary: a.summary || "",
      body: a.body,
      visibility: (a.visibility as any) || "internal",
      tags: (a.tags || []).join(", "),
      publish: !!a.publishedAt,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        title: values.title,
        slug: values.slug,
        summary: values.summary || null,
        body: values.body,
        visibility: values.visibility,
        tags: values.tags ? values.tags.split(",").map(s => s.trim()).filter(Boolean) : [],
        publishedAt: values.publish ? new Date().toISOString() : null,
      };
      if (editing) return apiRequest(`/api/support/kb/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      return apiRequest("/api/support/kb", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast({ title: editing ? "Article updated" : "Article created" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/kb"] });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/support/kb/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Article deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/kb"] });
    },
  });

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-4" data-testid="page-support-kb">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5" /> Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">Articles surface in the agent console and (when public) in the portal.</p>
          </div>
          <Button onClick={openCreate} data-testid="button-new-kb"><Plus className="h-4 w-4 mr-1" />New article</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : articles.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No articles yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((a) => (
                    <TableRow key={a.id} data-testid={`row-kb-${a.id}`}>
                      <TableCell className="font-medium max-w-[300px] truncate">{a.title}</TableCell>
                      <TableCell className="font-mono text-xs">{a.slug}</TableCell>
                      <TableCell><Badge variant="outline">{a.visibility}</Badge></TableCell>
                      <TableCell>{a.publishedAt ? <Badge>Published</Badge> : <Badge variant="secondary">Draft</Badge>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground"><Eye className="h-3 w-3 inline mr-1" />{a.viewCount}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(a)} data-testid={`button-edit-kb-${a.id}`}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" data-testid={`button-delete-kb-${a.id}`}><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete article?</AlertDialogTitle>
                              <AlertDialogDescription>"{a.title}" will be removed permanently.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove.mutate(a.id)}>Delete</AlertDialogAction>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit article" : "New article"}</DialogTitle>
            <DialogDescription>Markdown supported in body.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-kb-title"
                      onChange={(e) => {
                        field.onChange(e);
                        if (!editing && !form.getValues("slug")) {
                          form.setValue("slug", slugify(e.target.value));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="slug" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl><Input {...field} data-testid="input-kb-slug" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="visibility" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-kb-visibility"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {VISIBILITIES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="summary" render={({ field }) => (
                <FormItem>
                  <FormLabel>Summary</FormLabel>
                  <FormControl><Textarea rows={2} {...field} value={field.value || ""} data-testid="input-kb-summary" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl><Textarea rows={10} className="font-mono text-sm" {...field} data-testid="input-kb-body" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tags" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} placeholder="comma, separated" data-testid="input-kb-tags" /></FormControl>
                  <FormDescription className="text-xs">Comma-separated</FormDescription>
                </FormItem>
              )} />
              <FormField control={form.control} name="publish" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded border p-3">
                  <div>
                    <FormLabel className="m-0 flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /> Publish</FormLabel>
                    <FormDescription className="text-xs">When off, article is saved as draft.</FormDescription>
                  </div>
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4"
                      data-testid="checkbox-kb-publish"
                    />
                  </FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={save.isPending} data-testid="button-save-kb">
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
