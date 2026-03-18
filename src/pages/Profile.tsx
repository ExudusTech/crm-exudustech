import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Shield, Key, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: userPermissions } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_permissions" as any)
        .select("module, can_read, can_write, can_delete")
        .eq("user_id", user.id);
      return (data as any[]) ?? [];
    },
    enabled: !!user,
  });

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Senha alterada com sucesso." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    manager: "Gerente",
    viewer: "Visualizador",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{user?.email}</CardTitle>
                <CardDescription>
                  Conta criada em {user?.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR") : "—"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Roles & Permissions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Perfil e Permissões</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Perfis</Label>
              <div className="flex gap-2 mt-1.5">
                {userRoles && userRoles.length > 0 ? (
                  userRoles.map((r) => (
                    <Badge key={r.role} variant={r.role === "admin" ? "default" : "secondary"}>
                      {roleLabels[r.role] || r.role}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Nenhum perfil atribuído</span>
                )}
              </div>
            </div>

            {userPermissions && userPermissions.length > 0 && (
              <>
                <Separator />
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Permissões por Módulo</Label>
                  <div className="mt-2 space-y-2">
                    {userPermissions.map((p: any) => (
                      <div key={p.module} className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{p.module}</span>
                        <div className="flex gap-2">
                          {p.can_read && <Badge variant="outline" className="text-xs">Leitura</Badge>}
                          {p.can_write && <Badge variant="outline" className="text-xs">Escrita</Badge>}
                          {p.can_delete && <Badge variant="outline" className="text-xs">Exclusão</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Alterar Senha</CardTitle>
            </div>
            <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword}>
              {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Nova Senha
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
