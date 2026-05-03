import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { BookOpen } from "lucide-react";

export default function UserGuide() {
  const { data: content, isLoading } = useQuery<string>({
    queryKey: ["/docs/USER_GUIDE.md"],
    queryFn: async () => {
      const response = await fetch("/docs/USER_GUIDE.md");
      if (!response.ok) throw new Error("Failed to load user guide");
      return response.text();
    },
  });

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Guide</h1>
            <p className="text-xl text-muted-foreground">
              Palomar - Synozur Consulting Delivery Platform
            </p>
          </div>
        </div>

        <MarkdownViewer content={content} isLoading={isLoading} />
      </div>
    </Layout>
  );
}
