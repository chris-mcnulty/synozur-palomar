import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { LifeBuoy, Settings, ActivitySquare, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { user, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["admin"]);

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-muted-foreground">
            Constellation — Consulting Delivery & Support Platform
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/support">
            <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <LifeBuoy className="w-4 h-4" /> Support
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Open and manage support tickets, replies, and SLA-tracked work.
              </CardContent>
            </Card>
          </Link>

          <Link href="/user-guide">
            <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="w-4 h-4" /> User Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Documentation, changelog, and roadmap.
              </CardContent>
            </Card>
          </Link>

          {isAdmin && (
            <>
              <Link href="/system-settings">
                <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Settings className="w-4 h-4" /> System Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Configure platform-wide settings.
                  </CardContent>
                </Card>
              </Link>

              <Link href="/admin/agent-card-health">
                <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ActivitySquare className="w-4 h-4" /> Agent Card Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Monitor scheduler health and run on-demand checks.
                  </CardContent>
                </Card>
              </Link>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
