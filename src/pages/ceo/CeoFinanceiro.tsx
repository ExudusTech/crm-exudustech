import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, Building2, Plus, Edit2, Trash2,
  ArrowUpRight, ArrowDownRight, Wallet, AlertTriangle,
} from "lucide-react";

// Types matching DB
type FinancialStatus = "pendente" | "pago" | "recebido" | "atrasado" | "cancelado" | "parcial";
type RecurrenceType = "mensal" | "trimestral" | "semestral" | "anual" | "avulso";

const financialStatusLabels: Record<FinancialStatus, string> = {
  pendente: "Pendente", pago: "Pago", recebido: "Recebido", atrasado: "Atrasado", cancelado: "Cancelado", parcial: "Parcial",
};
const financialStatusColors: Record<FinancialStatus, string> = {
  pendente: "bg-yellow-500 text-white", pago: "bg-green-600 text-white", recebido: "bg-green-600 text-white",
  atrasado: "bg-destructive text-destructive-foreground", cancelado: "bg-muted text-muted-foreground", parcial: "bg-blue-600 text-white",
};
const recurrenceLabels: Record<RecurrenceType, string> = {
  mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual", avulso: "Avulso",
};

const fmt = (v: number | null) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const CeoFinanceiro = () => {
  const { toast } = useToast();
  const [revenues, setRevenues] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"revenue" | "expense" | "subscription" | "bank_account" | "credit_card">("revenue");
  const [editing, setEditing] = useState<any>({});
  const [deleteTarget, setDeleteTarget] = useState<{ table: string; id: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [r, e, s, b, c] = await Promise.all([
      (supabase as any).from("revenues").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("expenses").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("subscriptions").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("bank_accounts").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("credit_cards").select("*").order("created_at", { ascending: false }),
    ]);
    setRevenues(r.data || []);
    setExpenses(e.data || []);
    setSubscriptions(s.data || []);
    setBankAccounts(b.data || []);
    setCreditCards(c.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Computed KPIs
  const totalBankBalance = bankAccounts.reduce((s: number, a: any) => s + (a.current_balance || 0), 0);
  const totalCommitted = bankAccounts.reduce((s: number, a: any) => s + (a.committed_balance || 0), 0);
  const freeBalance = totalBankBalance - totalCommitted;
  const totalCardUsed = creditCards.reduce((s: number, c: any) => s + (c.used_limit || 0), 0);
  const totalCardLimit = creditCards.reduce((s: number, c: any) => s + (c.total_limit || 0), 0);
  const monthRevenues = revenues.filter((r: any) => r.status === "recebido").reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
  const monthExpenses = expenses.filter((e: any) => e.status === "pago").reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const pendingReceivables = revenues.filter((r: any) => r.status === "pendente").reduce((s: number, r: any) => s + (r.expected_amount || 0), 0);
  const pendingPayables = expenses.filter((e: any) => e.status === "pendente").reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const activeSubscriptions = subscriptions.filter((s: any) => s.status === "ativo");
  const monthlySubTotal = activeSubscriptions.reduce((s: number, sub: any) => s + (sub.monthly_amount || 0), 0);

  const openCreate = (type: typeof dialogType, defaults: any = {}) => {
    setDialogType(type);
    setEditing(defaults);
    setDialogOpen(true);
  };
  const openEdit = (type: typeof dialogType, record: any) => {
    setDialogType(type);
    setEditing({ ...record });
    setDialogOpen(true);
  };

  const tableMap: Record<string, string> = {
    revenue: "revenues", expense: "expenses", subscription: "subscriptions",
    bank_account: "bank_accounts", credit_card: "credit_cards",
  };

  const handleSave = async () => {
    const table = tableMap[dialogType];
    const { id, created_at, updated_at, ...rest } = editing;
    if (id) {
      const { error } = await (supabase as any).from(table).update(rest).eq("id", id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Atualizado" });
    } else {
      const { error } = await (supabase as any).from(table).insert(rest);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Criado" });
    }
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).from(deleteTarget.table).delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Excluído" });
    setDeleteTarget(null);
    fetchAll();
  };

  const dialogTitles: Record<string, string> = {
    revenue: "Receita", expense: "Despesa", subscription: "Assinatura",
    bank_account: "Conta Bancária", credit_card: "Cartão de Crédito",
  };

  if (loading) return <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground text-sm">Gestão financeira empresarial</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="revenues">Receitas</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="accounts">Contas / Cartões</TabsTrigger>
          <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="costcenters">Centros de Custo</TabsTrigger>
        </TabsList>

        {/* === VISÃO GERAL === */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Bancário</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{fmt(totalBankBalance)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Comprometido</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{fmt(totalCommitted)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Livre Real</CardTitle>
                <Wallet className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent><div className={`text-2xl font-bold ${freeBalance < 0 ? "text-destructive" : ""}`}>{fmt(freeBalance)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cartões (usado/limite)</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{fmt(totalCardUsed)} <span className="text-sm text-muted-foreground">/ {fmt(totalCardLimit)}</span></div></CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receitas Recebidas</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-600">{fmt(monthRevenues)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Despesas Pagas</CardTitle>
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-destructive">{fmt(monthExpenses)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{fmt(pendingReceivables)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">A Pagar</CardTitle>
                <TrendingDown className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{fmt(pendingPayables)}</div></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Assinaturas Ativas ({activeSubscriptions.length})</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">Total mensal: <strong>{fmt(monthlySubTotal)}</strong></p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {activeSubscriptions.slice(0, 6).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between border rounded-md p-2">
                    <span className="text-sm font-medium">{s.service_name}</span>
                    <span className="text-sm text-muted-foreground">{fmt(s.monthly_amount)}/mês</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === RECEITAS === */}
        <TabsContent value="revenues" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openCreate("revenue", { description: "", expected_amount: 0, status: "pendente" })}>
              <Plus className="h-4 w-4 mr-1" /> Nova Receita
            </Button>
          </div>
          <Card>
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Descrição</TableHead><TableHead>Previsto</TableHead><TableHead>Recebido</TableHead>
                  <TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="w-20">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {revenues.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma receita</TableCell></TableRow>}
                  {revenues.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.description || "—"}</TableCell>
                      <TableCell>{fmt(r.expected_amount)}</TableCell>
                      <TableCell>{fmt(r.received_amount)}</TableCell>
                      <TableCell>{r.due_date || "—"}</TableCell>
                      <TableCell><Badge className={financialStatusColors[r.status as FinancialStatus] || ""}>{financialStatusLabels[r.status as FinancialStatus] || r.status}</Badge></TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit("revenue", r)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ table: "revenues", id: r.id })}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* === DESPESAS === */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openCreate("expense", { description: "", amount: 0, status: "pendente", recurrence: "avulso" })}>
              <Plus className="h-4 w-4 mr-1" /> Nova Despesa
            </Button>
          </div>
          <Card>
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Descrição</TableHead><TableHead>Fornecedor</TableHead><TableHead>Valor</TableHead>
                  <TableHead>Recorrência</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="w-20">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {expenses.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma despesa</TableCell></TableRow>}
                  {expenses.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.description || "—"}</TableCell>
                      <TableCell>{e.supplier || "—"}</TableCell>
                      <TableCell>{fmt(e.amount)}</TableCell>
                      <TableCell>{recurrenceLabels[e.recurrence as RecurrenceType] || e.recurrence}</TableCell>
                      <TableCell>{e.due_date || "—"}</TableCell>
                      <TableCell><Badge className={financialStatusColors[e.status as FinancialStatus] || ""}>{financialStatusLabels[e.status as FinancialStatus] || e.status}</Badge></TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit("expense", e)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ table: "expenses", id: e.id })}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* === ASSINATURAS === */}
        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openCreate("subscription", { service_name: "", monthly_amount: 0, status: "ativo", criticality: "media" })}>
              <Plus className="h-4 w-4 mr-1" /> Nova Assinatura
            </Button>
          </div>
          <Card>
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Serviço</TableHead><TableHead>Categoria</TableHead><TableHead>Mensal</TableHead>
                  <TableHead>Anual</TableHead><TableHead>Dia Cobrança</TableHead><TableHead>Status</TableHead><TableHead className="w-20">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {subscriptions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma assinatura</TableCell></TableRow>}
                  {subscriptions.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.service_name}</TableCell>
                      <TableCell>{s.category || "—"}</TableCell>
                      <TableCell>{fmt(s.monthly_amount)}</TableCell>
                      <TableCell>{fmt(s.annual_amount)}</TableCell>
                      <TableCell>{s.billing_day || "—"}</TableCell>
                      <TableCell><Badge className={s.status === "ativo" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}>{s.status === "ativo" ? "Ativo" : s.status}</Badge></TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit("subscription", s)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ table: "subscriptions", id: s.id })}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* === CONTAS / CARTÕES === */}
        <TabsContent value="accounts" className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Contas Bancárias</h2>
              <Button size="sm" onClick={() => openCreate("bank_account", { name: "", bank: "", current_balance: 0, committed_balance: 0, status: "ativo" })}>
                <Plus className="h-4 w-4 mr-1" /> Nova Conta
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankAccounts.map((a: any) => (
                <Card key={a.id}>
                  <CardHeader className="pb-2 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{a.bank || "—"}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit("bank_account", a)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget({ table: "bank_accounts", id: a.id })}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Saldo</span><span className="font-medium">{fmt(a.current_balance)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Comprometido</span><span>{fmt(a.committed_balance)}</span></div>
                    <div className="flex justify-between text-sm font-semibold"><span>Livre</span><span className={(a.current_balance - a.committed_balance) < 0 ? "text-destructive" : ""}>{fmt((a.current_balance || 0) - (a.committed_balance || 0))}</span></div>
                  </CardContent>
                </Card>
              ))}
              {bankAccounts.length === 0 && <p className="text-sm text-muted-foreground col-span-3">Nenhuma conta cadastrada</p>}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Cartões de Crédito</h2>
              <Button size="sm" onClick={() => openCreate("credit_card", { name: "", total_limit: 0, used_limit: 0, status: "ativo" })}>
                <Plus className="h-4 w-4 mr-1" /> Novo Cartão
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creditCards.map((c: any) => (
                <Card key={c.id}>
                  <CardHeader className="pb-2 flex flex-row items-start justify-between">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit("credit_card", c)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget({ table: "credit_cards", id: c.id })}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Limite</span><span>{fmt(c.total_limit)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Usado</span><span className="text-destructive">{fmt(c.used_limit)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Disponível</span><span>{fmt((c.total_limit || 0) - (c.used_limit || 0))}</span></div>
                    {c.due_day && <p className="text-xs text-muted-foreground">Vencimento dia {c.due_day}</p>}
                  </CardContent>
                </Card>
              ))}
              {creditCards.length === 0 && <p className="text-sm text-muted-foreground col-span-3">Nenhum cartão cadastrado</p>}
            </div>
          </div>
        </TabsContent>

        {/* === FLUXO DE CAIXA === */}
        <TabsContent value="cashflow" className="space-y-4">
          <CashflowSection revenues={revenues} expenses={expenses} subscriptions={subscriptions} bankAccounts={bankAccounts} />
        </TabsContent>

        {/* === CENTROS DE CUSTO === */}
        <TabsContent value="costcenters" className="space-y-4">
          <CostCentersSection />
        </TabsContent>
      </Tabs>

      {/* === DIALOG CRUD === */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Novo(a)"} {dialogTitles[dialogType]}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {dialogType === "revenue" && <>
              <div><Label>Descrição</Label><Input value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor Previsto</Label><Input type="number" value={editing.expected_amount || ""} onChange={e => setEditing({ ...editing, expected_amount: +e.target.value })} /></div>
                <div><Label>Valor Recebido</Label><Input type="number" value={editing.received_amount || ""} onChange={e => setEditing({ ...editing, received_amount: +e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Vencimento</Label><Input type="date" value={editing.due_date || ""} onChange={e => setEditing({ ...editing, due_date: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={editing.status || "pendente"} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(financialStatusLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Forma Pagamento</Label><Input value={editing.payment_method || ""} onChange={e => setEditing({ ...editing, payment_method: e.target.value })} /></div>
              <div><Label>Nº Nota Fiscal</Label><Input value={editing.invoice_number || ""} onChange={e => setEditing({ ...editing, invoice_number: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
            </>}
            {dialogType === "expense" && <>
              <div><Label>Descrição</Label><Input value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
              <div><Label>Fornecedor</Label><Input value={editing.supplier || ""} onChange={e => setEditing({ ...editing, supplier: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor</Label><Input type="number" value={editing.amount || ""} onChange={e => setEditing({ ...editing, amount: +e.target.value })} /></div>
                <div><Label>Recorrência</Label>
                  <Select value={editing.recurrence || "avulso"} onValueChange={v => setEditing({ ...editing, recurrence: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(recurrenceLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Vencimento</Label><Input type="date" value={editing.due_date || ""} onChange={e => setEditing({ ...editing, due_date: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={editing.status || "pendente"} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(financialStatusLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Categoria</Label><Input value={editing.category || ""} onChange={e => setEditing({ ...editing, category: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
            </>}
            {dialogType === "subscription" && <>
              <div><Label>Serviço</Label><Input value={editing.service_name || ""} onChange={e => setEditing({ ...editing, service_name: e.target.value })} /></div>
              <div><Label>Categoria</Label><Input value={editing.category || ""} onChange={e => setEditing({ ...editing, category: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor Mensal</Label><Input type="number" value={editing.monthly_amount || ""} onChange={e => setEditing({ ...editing, monthly_amount: +e.target.value })} /></div>
                <div><Label>Valor Anual</Label><Input type="number" value={editing.annual_amount || ""} onChange={e => setEditing({ ...editing, annual_amount: +e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Dia Cobrança</Label><Input type="number" value={editing.billing_day || ""} onChange={e => setEditing({ ...editing, billing_day: +e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={editing.status || "ativo"} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="pausado">Pausado</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Meio de Pagamento</Label><Input value={editing.payment_method || ""} onChange={e => setEditing({ ...editing, payment_method: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
            </>}
            {dialogType === "bank_account" && <>
              <div><Label>Nome da Conta</Label><Input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Banco</Label><Input value={editing.bank || ""} onChange={e => setEditing({ ...editing, bank: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Saldo Atual</Label><Input type="number" value={editing.current_balance || ""} onChange={e => setEditing({ ...editing, current_balance: +e.target.value })} /></div>
                <div><Label>Saldo Comprometido</Label><Input type="number" value={editing.committed_balance || ""} onChange={e => setEditing({ ...editing, committed_balance: +e.target.value })} /></div>
              </div>
              <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
            </>}
            {dialogType === "credit_card" && <>
              <div><Label>Nome do Cartão</Label><Input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Limite Total</Label><Input type="number" value={editing.total_limit || ""} onChange={e => setEditing({ ...editing, total_limit: +e.target.value })} /></div>
                <div><Label>Limite Usado</Label><Input type="number" value={editing.used_limit || ""} onChange={e => setEditing({ ...editing, used_limit: +e.target.value })} /></div>
              </div>
              <div><Label>Dia Vencimento</Label><Input type="number" value={editing.due_day || ""} onChange={e => setEditing({ ...editing, due_day: +e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
            </>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoFinanceiro;
