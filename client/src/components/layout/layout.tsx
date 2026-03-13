import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { HelpChat } from "@/components/HelpChat";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { PlanStatusBanner } from "@/components/plan-status-banner";
import { useIsEmbedded } from "@/hooks/use-is-embedded";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isEmbedded = useIsEmbedded();

  if (isEmbedded) {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PlanStatusBanner />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
      <HelpChat />
      <WhatsNewModal />
    </div>
  );
}
