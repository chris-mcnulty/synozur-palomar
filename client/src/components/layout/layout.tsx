import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { useEmbed } from "@/hooks/use-embed";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isEmbedded } = useEmbed();

  if (isEmbedded) {
    return <main className="min-h-screen bg-background">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
