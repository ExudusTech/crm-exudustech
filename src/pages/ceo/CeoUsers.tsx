import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Shield, ShieldCheck, Eye, UserPlus, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";

interface UserProfile {
  id: string;
  full_name: string | null;
  role_function: string | null;
  email?: string;
  roles: string[];
}

const MODULES = [
  { key: "ceo_dashboard", label: "Dashboard CEO" },
  { key: "ceo_iniciativas", label: "Iniciativas" },
  { key: "ceo_financeiro", label: "Financeiro" },
  { key: "ceo_tarefas", label: "Tarefas" },
  { key: "ceo_radar", label: "Radar" },
  { key: "ceo_organizacoes", label: "Organizações" },
  { key: "ceo_stakeholders", label: "Stakeholders" },
  { key: "ceo_projetos", label: "Projetos" },
  { key: "ceo_produtos", label: "Produtos" },
  { key: "ceo_ia", label: "IA / Assistente" },
  { key: "crm", label: "CRM" },
  { key: "configuracoes", label: "Configurações" },
];

const CeoUsers = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Record<string, { can_read: boolean; can_write: boolean; can_delete: boolean }>>({});

  // New user form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<string>("viewer");
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    if (profiles) {
      const userList: UserProfile[] = profiles.map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        role_function: p.role_function,
        roles: roles?.filter((r: any) => r.user_id === p.id).map((r: any) => r.role) || [],
      }));
      setUsers(userList);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword || newPassword.length < 6) {
      toast({ title: "Erro", description: "Preencha email e senha (min 6 caracteres)", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      // Use edge function to create user as admin
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: newEmail, password: newPassword, full_name: newName, role: newRole },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Sucesso", description: `Usuário ${newEmail} criado com sucesso` });
      setCreateOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("viewer");
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao criar usuário", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const openPermissions = async (u: UserProfile) => {
    setSelectedUser(u);
    const isUserAdmin = u.roles.includes("admin");
    
    if (isUserAdmin) {
      // Admin has all permissions by default
      const perms: Record<string, { can_read: boolean; can_write: boolean; can_delete: boolean }> = {};
      MODULES.forEach(m => {
        perms[m.key] = { can_read: true, can_write: true, can_delete: true };
      });
      setPermissions(perms);
      setPermissionsOpen(true);
      return;
    }

    const { data } = await supabase.from("user_permissions").select("*").eq("user_id", u.id);
    
    const perms: Record<string, { can_read: boolean; can_write: boolean; can_delete: boolean }> = {};
    MODULES.forEach(m => {
      const existing = data?.find((d: any) => d.module === m.key);
      perms[m.key] = {
        can_read: existing?.can_read ?? true,
        can_write: existing?.can_write ?? false,
        can_delete: existing?.can_delete ?? false,
      };
    });
    setPermissions(perms);
    setPermissionsOpen(true);
  };

  const savePermissions = async () => {
    if (!selectedUser) return;

    try {
      for (const mod of MODULES) {
        const perm = permissions[mod.key];
        await supabase.from("user_permissions").upsert({
          user_id: selectedUser.id,
          module: mod.key,
          can_read: perm.can_read,
          can_write: perm.can_write,
          can_delete: perm.can_delete,
        }, { onConflict: "user_id,module" });
      }
      toast({ title: "Sucesso", description: "Permissões atualizadas" });
      setPermissionsOpen(false);
    } catch {
      toast({ title: "Erro", description: "Erro ao salvar permissões", variant: "destructive" });
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // Remove old roles
      await supabase.from("user_roles").delete().eq("user_id", userId);
      // Insert new
      await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
      toast({ title: "Sucesso", description: "Papel atualizado" });
      fetchUsers();
    } catch {
      toast({ title: "Erro", description: "Erro ao atualizar papel", variant: "destructive" });
    }
  };

  const deleteUser = async (userId: string) => {
    if (userId === user?.id) {
      toast({ title: "Erro", description: "Você não pode excluir a si mesmo", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error;
      toast({ title: "Sucesso", description: "Usuário removido" });
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao remover", variant: "destructive" });
    }
  };

  if (roleLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isAdmin) {
    return <Navigate to="/ceo" replace />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-muted-foreground text-sm">Controle de acesso e permissões</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateUser} disabled={creating} className="w-full">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar Usuário
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {u.roles.includes("admin") ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Shield className="h-4 w-4 text-muted-foreground" />}
                        {u.full_name || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.id === user?.id ? (
                        <Badge variant="default">Admin</Badge>
                      ) : (
                        <Select
                          value={u.roles[0] || "viewer"}
                          onValueChange={(val) => updateUserRole(u.id, val)}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Gerente</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.roles.includes("admin") ? "Administrador" : u.roles.includes("manager") ? "Gerente" : "Visualizador"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openPermissions(u)}>
                          <Eye className="h-4 w-4 mr-1" /> Permissões
                        </Button>
                        {u.id !== user?.id && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteUser(u.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Permissions Dialog */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Permissões — {selectedUser?.full_name}
              {selectedUser?.roles.includes("admin") && (
                <Badge variant="default" className="ml-2">Admin — Acesso Total</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedUser?.roles.includes("admin") && (
            <p className="text-sm text-muted-foreground">Administradores possuem acesso total a todos os módulos. Estas permissões não podem ser alteradas.</p>
          )}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {MODULES.map(mod => {
              const isAdminUser = selectedUser?.roles.includes("admin");
              return (
                <div key={mod.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm font-medium">{mod.label}</span>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={permissions[mod.key]?.can_read ?? true}
                        onCheckedChange={v => setPermissions(p => ({ ...p, [mod.key]: { ...p[mod.key], can_read: v } }))}
                        disabled={isAdminUser}
                      />
                      <span className="text-xs text-muted-foreground">Ler</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={permissions[mod.key]?.can_write ?? false}
                        onCheckedChange={v => setPermissions(p => ({ ...p, [mod.key]: { ...p[mod.key], can_write: v } }))}
                        disabled={isAdminUser}
                      />
                      <span className="text-xs text-muted-foreground">Editar</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={permissions[mod.key]?.can_delete ?? false}
                        onCheckedChange={v => setPermissions(p => ({ ...p, [mod.key]: { ...p[mod.key], can_delete: v } }))}
                        disabled={isAdminUser}
                      />
                      <span className="text-xs text-muted-foreground">Excluir</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {!selectedUser?.roles.includes("admin") && (
            <Button onClick={savePermissions} className="w-full mt-2">Salvar Permissões</Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CeoUsers;
