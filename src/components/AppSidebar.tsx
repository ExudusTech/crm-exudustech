import {
  User,
  LayoutDashboard,
  Radar,
  Rocket,
  FolderKanban,
  Package,
  Building2,
  Users,
  CheckSquare,
  CalendarDays,
  DollarSign,
  Receipt,
  Server,
  FileText,
  Puzzle,
  Bot,
  Settings,
  MessageSquare,
  Inbox,
  Archive,
  TrendingUp,
  ChevronDown,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import exudusLogo from "@/assets/logo-exudus.jpeg";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ceoItems = [
  { title: "Dashboard", url: "/ceo", icon: LayoutDashboard },
  { title: "Radar Estratégico", url: "/ceo/radar", icon: Radar },
  { title: "Iniciativas", url: "/ceo/iniciativas", icon: Rocket },
  { title: "Projetos", url: "/ceo/projetos", icon: FolderKanban },
  { title: "Produtos", url: "/ceo/produtos", icon: Package },
  { title: "Organizações", url: "/ceo/organizacoes", icon: Building2 },
  { title: "Stakeholders", url: "/ceo/stakeholders", icon: Users },
  { title: "Tarefas", url: "/ceo/tarefas", icon: CheckSquare },
  { title: "Agenda", url: "/ceo/agenda", icon: CalendarDays },
  { title: "Memória", url: "/ceo/memoria", icon: Archive },
  { title: "Financeiro", url: "/ceo/financeiro", icon: DollarSign },
  { title: "Fiscal", url: "/ceo/fiscal", icon: Receipt },
  { title: "Infraestrutura", url: "/ceo/infraestrutura", icon: Server },
  { title: "Documentos", url: "/ceo/documentos", icon: FileText },
  { title: "Módulos", url: "/ceo/modulos", icon: Puzzle },
  { title: "IA Assistente", url: "/ceo/ia", icon: Bot },
  { title: "Usuários", url: "/ceo/usuarios", icon: Users },
];

const crmItems = [
  { title: "Oportunidades", url: "/crm", icon: MessageSquare },
  { title: "Não Classificados", url: "/crm/unclassified", icon: Inbox },
  { title: "Arquivados", url: "/crm/archived", icon: Archive },
  { title: "Insights", url: "/crm/insights", icon: TrendingUp },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/crm" && currentPath === "/") return true;
    if (path === "/crm" && currentPath === "/crm") return true;
    if (path === "/crm" && currentPath === "/opportunities") return true;
    return currentPath === path || currentPath.startsWith(path + "/");
  };

  const isCeoSection = currentPath.startsWith("/ceo");
  const isCrmSection = !isCeoSection;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-0">
        <div
          onClick={() => navigate("/ceo")}
          className="cursor-pointer flex flex-col items-center gap-1 px-2 py-3"
        >
          <img
            src={exudusLogo}
            alt="ExudusTech"
            className={collapsed ? "h-8 w-8 rounded-md object-cover" : "w-full max-h-16 object-contain rounded-md"}
          />
          {!collapsed && (
            <span className="text-xs text-muted-foreground">Sistema CEO</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* CEO Section */}
        <Collapsible defaultOpen={isCeoSection} className="group/collapsible">
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:text-foreground">
                CEO
                {!collapsed && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {ceoItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                        onClick={() => navigate(item.url)}
                        className="cursor-pointer"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarSeparator />

        {/* CRM Section */}
        <Collapsible defaultOpen={isCrmSection} className="group/collapsible">
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:text-foreground">
                CRM
                {!collapsed && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {crmItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                        onClick={() => navigate(item.url)}
                        className="cursor-pointer"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarSeparator />

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive("/configuracoes")}
                  tooltip="Configurações"
                  onClick={() => navigate("/configuracoes")}
                  className="cursor-pointer"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>Configurações</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* User Profile Card */}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Meu Perfil"
              onClick={() => navigate("/perfil")}
              className="cursor-pointer"
            >
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              {!collapsed && (
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-xs font-medium truncate">{user?.email ?? "Usuário"}</span>
                  <span className="text-[10px] text-muted-foreground">Ver perfil</span>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={theme === "dark" ? "Modo claro" : "Modo escuro"}
              onClick={toggleTheme}
              className="cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
              {!collapsed && <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sair"
              onClick={() => signOut()}
              className="cursor-pointer text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
