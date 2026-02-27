import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppHeader from "@/components/AppHeader";
import Opportunities from "./pages/Opportunities";
import OpportunityDetail from "./pages/OpportunityDetail";
import Unclassified from "./pages/Unclassified";
import Archived from "./pages/Archived";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Proposal from "./pages/Proposal";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppHeader />
    {children}
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedLayout><Opportunities /></ProtectedLayout>} />
              <Route path="/opportunities" element={<ProtectedLayout><Opportunities /></ProtectedLayout>} />
              <Route path="/opportunity/:id" element={<ProtectedLayout><OpportunityDetail /></ProtectedLayout>} />
              <Route path="/unclassified" element={<ProtectedLayout><Unclassified /></ProtectedLayout>} />
              <Route path="/archived" element={<ProtectedLayout><Archived /></ProtectedLayout>} />
              <Route path="/proposal" element={<ProtectedLayout><Proposal /></ProtectedLayout>} />
              <Route path="/insights" element={<ProtectedLayout><Insights /></ProtectedLayout>} />
              <Route path="/configuracoes" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
