import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/AppLayout";

// CRM pages (preserved)
import Opportunities from "./pages/Opportunities";
import OpportunityDetail from "./pages/OpportunityDetail";
import Unclassified from "./pages/Unclassified";
import Archived from "./pages/Archived";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Proposal from "./pages/Proposal";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";

// CEO pages
import CeoDashboard from "./pages/ceo/CeoDashboard";
import CeoPlaceholder from "./pages/ceo/CeoPlaceholder";
import CeoRadar from "./pages/ceo/CeoRadar";
import CeoOrganizations from "./pages/ceo/CeoOrganizations";
import CeoTasks from "./pages/ceo/CeoTasks";
import CeoFinanceiro from "./pages/ceo/CeoFinanceiro";
import CeoStakeholders from "./pages/ceo/CeoStakeholders";
import CeoAgenda from "./pages/ceo/CeoAgenda";
import CeoIniciativas from "./pages/ceo/CeoIniciativas";
import CeoProjetos from "./pages/ceo/CeoProjetos";
import CeoProdutos from "./pages/ceo/CeoProdutos";
import CeoFiscal from "./pages/ceo/CeoFiscal";

const queryClient = new QueryClient();

const WithLayout = ({ children }: { children: React.ReactNode }) => (
  <AppLayout>{children}</AppLayout>
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

              {/* CEO Routes */}
              <Route path="/ceo" element={<WithLayout><CeoDashboard /></WithLayout>} />
              <Route path="/ceo/radar" element={<WithLayout><CeoRadar /></WithLayout>} />
              <Route path="/ceo/iniciativas" element={<WithLayout><CeoIniciativas /></WithLayout>} />
              <Route path="/ceo/projetos" element={<WithLayout><CeoProjetos /></WithLayout>} />
              <Route path="/ceo/produtos" element={<WithLayout><CeoProdutos /></WithLayout>} />
              <Route path="/ceo/organizacoes" element={<WithLayout><CeoOrganizations /></WithLayout>} />
              <Route path="/ceo/stakeholders" element={<WithLayout><CeoStakeholders /></WithLayout>} />
              <Route path="/ceo/tarefas" element={<WithLayout><CeoTasks /></WithLayout>} />
              <Route path="/ceo/financeiro" element={<WithLayout><CeoFinanceiro /></WithLayout>} />
              <Route path="/ceo/agenda" element={<WithLayout><CeoAgenda /></WithLayout>} />
              <Route path="/ceo/fiscal" element={<WithLayout><CeoPlaceholder title="Fiscal" description="Gestão fiscal e contábil." /></WithLayout>} />
              <Route path="/ceo/infraestrutura" element={<WithLayout><CeoPlaceholder title="Infraestrutura" description="Controle dos ativos técnicos e operacionais." /></WithLayout>} />
              <Route path="/ceo/documentos" element={<WithLayout><CeoPlaceholder title="Documentos" description="Repositório documental central." /></WithLayout>} />
              <Route path="/ceo/modulos" element={<WithLayout><CeoPlaceholder title="Módulos ExudusTech" description="Mapeamento de modularidade e reaproveitamento." /></WithLayout>} />
              <Route path="/ceo/ia" element={<WithLayout><CeoPlaceholder title="IA / Assistente CEO" description="Área conversacional do sistema." /></WithLayout>} />

              {/* CRM Routes (preserved) */}
              <Route path="/crm" element={<WithLayout><Opportunities /></WithLayout>} />
              <Route path="/crm/unclassified" element={<WithLayout><Unclassified /></WithLayout>} />
              <Route path="/crm/archived" element={<WithLayout><Archived /></WithLayout>} />
              <Route path="/crm/insights" element={<WithLayout><Insights /></WithLayout>} />

              {/* Legacy CRM route compatibility */}
              <Route path="/opportunities" element={<Navigate to="/crm" replace />} />
              <Route path="/opportunity/:id" element={<WithLayout><OpportunityDetail /></WithLayout>} />
              <Route path="/unclassified" element={<Navigate to="/crm/unclassified" replace />} />
              <Route path="/archived" element={<Navigate to="/crm/archived" replace />} />
              <Route path="/insights" element={<Navigate to="/crm/insights" replace />} />

              {/* Shared */}
              <Route path="/proposal" element={<WithLayout><Proposal /></WithLayout>} />
              <Route path="/configuracoes" element={<WithLayout><Settings /></WithLayout>} />

              {/* Home → CEO Dashboard */}
              <Route path="/" element={<Navigate to="/ceo" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
