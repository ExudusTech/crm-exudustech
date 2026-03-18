import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GlobalSearch } from "@/components/ceo/GlobalSearch";
import { VoiceAssistant } from "@/components/ceo/VoiceAssistant";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="sticky top-0 z-40 h-12 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSearchOpen(true)} className="gap-2 text-muted-foreground">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Buscar...</span>
                  <kbd className="hidden sm:inline pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    ⌘K
                  </kbd>
                </Button>
                <VoiceAssistant />
              </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
          </div>
        </div>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </SidebarProvider>
    </ProtectedRoute>
  );
}
