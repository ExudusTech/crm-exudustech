import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Radar, DollarSign, CheckSquare, Bot, CalendarDays,
  AlertTriangle, TrendingUp, Clock, Building2, Users, Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { priorityLabels, priorityColors, taskStatusLabels } from "@/types/ceo";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const CeoDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    initiativeCount: 0, overdueTaskCount: 0, orgCount: 0, stakeholderCount: 0,
    totalBalance: 0, committedBalance: 0, freeBalance: 0,
    monthRevenues: 0, monthExpenses: 0, pendingReceivables: 0, pendingPayables: 0,
    activeSubsTotal: 0,
  });
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [recentAssets, setRecentAssets] = useState<any[]>([]);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [recentLessons, setRecentLessons] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [initiatives, tasks, orgs, stakeholders, banks, revenues, expenses, subs, assets, events, lessons] = await Promise.all([
        (supabase as any).from("initiatives").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        (supabase as any).from("ceo_tasks").select("*").in("status", ["todo", "doing", "bloqueado"]),
        (supabase as any).from("organizations").select("id", { count: "exact", head: true }),
        (supabase as any).from("stakeholders").select("id", { count: "exact", head: true }),
        (supabase as any).from("bank_accounts").select("current_balance,committed_balance"),
        (supabase as any).from("revenues").select("expected_amount,received_amount,status"),
        (supabase as any).from("expenses").select("amount,status"),
        (supabase as any).from("subscriptions").select("monthly_amount,status"),
        (supabase as any).from("strategic_assets").select("id,name,asset_type,status,priority").order("created_at", { ascending: false }).limit(5),
        (supabase as any).from("ceo_events").select("*").gte("event_date", new Date().toISOString().slice(0, 10)).lte("event_date", new Date().toISOString().slice(0, 10) + "T23:59:59").order("event_date", { ascending: true }).limit(5),
        (supabase as any).from("lessons_learned").select("id,title,category,created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const allTasks = tasks.data || [];
      const overdue = allTasks.filter((t: any) => t.deadline && t.deadline < today && t.status !== "done");

      const bankData = banks.data || [];
      const totalBal = bankData.reduce((s: number, b: any) => s + (b.current_balance || 0), 0);
      const committed = bankData.reduce((s: number, b: any) => s + (b.committed_balance || 0), 0);

      const revData = revenues.data || [];
      const expData = expenses.data || [];
      const subData = subs.data || [];

      setKpis({
        initiativeCount: initiatives.count || 0,
        overdueTaskCount: overdue.length,
        orgCount: orgs.count || 0,
        stakeholderCount: stakeholders.count || 0,
        totalBalance: totalBal,
        committedBalance: committed,
        freeBalance: totalBal - committed,
        monthRevenues: revData.filter((r: any) => r.status === "recebido").reduce((s: number, r: any) => s + (r.received_amount || 0), 0),
        monthExpenses: expData.filter((e: any) => e.status === "pago").reduce((s: number, e: any) => s + (e.amount || 0), 0),
        pendingReceivables: revData.filter((r: any) => r.status === "pendente").reduce((s: number, r: any) => s + (r.expected_amount || 0), 0),
        pendingPayables: expData.filter((e: any) => e.status === "pendente").reduce((s: number, e: any) => s + (e.amount || 0), 0),
        activeSubsTotal: subData.filter((s: any) => s.status === "ativo").reduce((sum: number, s: any) => sum + (s.monthly_amount || 0), 0),
      });
      setOverdueTasks(overdue.slice(0, 5));
      setRecentAssets(assets.data || []);
      setTodayEvents(events.data || []);
      setRecentLessons(lessons.data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="p-6 space-y-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Executivo</h1>
          <p className="text-muted-foreground text-sm">Visão consolidada do negócio</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/ceo/tarefas")}>
            <CheckSquare className="h-4 w-4 mr-1" /> Tarefas
          </Button>
          <Button size="sm" onClick={() => navigate("/ceo/radar")}>
            <Radar className="h-4 w-4 mr-1" /> Radar
          </Button>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/ceo/radar")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Iniciativas Ativas</CardTitle>
            <Radar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{kpis.initiativeCount}</div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/ceo/tarefas")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tarefas Atrasadas</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${kpis.overdueTaskCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent><div className={`text-2xl font-bold ${kpis.overdueTaskCount > 0 ? "text-destructive" : ""}`}>{kpis.overdueTaskCount}</div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/ceo/organizacoes")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Organizações</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{kpis.orgCount}</div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/ceo/stakeholders")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stakeholders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{kpis.stakeholderCount}</div></CardContent>
        </Card>
      </div>

      {/* KPI Row 2 - Financial */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/ceo/financeiro")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Livre Real</CardTitle>
            <Wallet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className={`text-2xl font-bold ${kpis.freeBalance < 0 ? "text-destructive" : ""}`}>{fmt(kpis.freeBalance)}</div>
            <p className="text-xs text-muted-foreground">Banco: {fmt(kpis.totalBalance)} · Comprometido: {fmt(kpis.committedBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmt(kpis.monthRevenues)}</div>
            <p className="text-xs text-muted-foreground">A receber: {fmt(kpis.pendingReceivables)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{fmt(kpis.monthExpenses)}</div>
            <p className="text-xs text-muted-foreground">A pagar: {fmt(kpis.pendingPayables)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assinaturas/mês</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmt(kpis.activeSubsTotal)}</div></CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" /> Tarefas Atrasadas</CardTitle></CardHeader>
          <CardContent>
            {overdueTasks.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">Tudo em dia! 🎉</div>
            ) : (
              <div className="space-y-2">
                {overdueTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between border rounded-md p-3">
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.responsible || "Sem responsável"} · Prazo: {t.deadline}</p>
                    </div>
                    {t.priority && <Badge className={priorityColors[t.priority as keyof typeof priorityColors]}>{priorityLabels[t.priority as keyof typeof priorityLabels]}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Radar */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Radar className="h-4 w-4" /> Radar Recente</CardTitle></CardHeader>
          <CardContent>
            {recentAssets.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">Nenhum ativo no radar</div>
            ) : (
              <div className="space-y-2">
                {recentAssets.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between border rounded-md p-2">
                    <span className="text-sm font-medium truncate">{a.name}</span>
                    {a.priority && <Badge variant="outline" className="text-xs">{priorityLabels[a.priority as keyof typeof priorityLabels]}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agenda do dia + Lições */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Agenda de Hoje</CardTitle></CardHeader>
          <CardContent>
            {todayEvents.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">Sem compromissos hoje</div>
            ) : (
              <div className="space-y-2">
                {todayEvents.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between border rounded-md p-3">
                    <div>
                      <p className="text-sm font-medium">{e.title}</p>
                      {e.location && <p className="text-xs text-muted-foreground">{e.location}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(e.event_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Lições Recentes</CardTitle></CardHeader>
          <CardContent>
            {recentLessons.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">Nenhuma lição registrada</div>
            ) : (
              <div className="space-y-2">
                {recentLessons.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between border rounded-md p-3">
                    <p className="text-sm font-medium">{l.title}</p>
                    {l.category && <Badge variant="outline" className="text-xs">{l.category}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Atalhos Rápidos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: CheckSquare, label: "Criar Tarefa", path: "/ceo/tarefas" },
              { icon: Radar, label: "Ver Radar", path: "/ceo/radar" },
              { icon: DollarSign, label: "Ver Caixa", path: "/ceo/financeiro" },
              { icon: Building2, label: "Organizações", path: "/ceo/organizacoes" },
              { icon: Users, label: "Stakeholders", path: "/ceo/stakeholders" },
              { icon: CalendarDays, label: "Abrir Agenda", path: "/ceo/agenda" },
            ].map((action) => (
              <Button key={action.label} variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate(action.path)}>
                <action.icon className="h-5 w-5" />
                <span className="text-xs text-center">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CeoDashboard;
