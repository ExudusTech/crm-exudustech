import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays, Mail, HardDrive, Link2, Unlink, RefreshCw, CheckCircle2,
  XCircle, Clock, ExternalLink, Loader2, Shield,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GoogleConnection {
  id: string;
  email: string;
  status: string;
  scopes: string[];
  connected_at: string;
  last_sync_at: string | null;
  token_expires_at: string;
}

const SERVICE_MAP = [
  {
    key: "calendar",
    label: "Google Calendar",
    icon: CalendarDays,
    scope: "https://www.googleapis.com/auth/calendar",
    description: "Acesse e gerencie sua agenda diretamente pelo Sistema CEO",
  },
  {
    key: "gmail",
    label: "Gmail",
    icon: Mail,
    scope: "https://www.googleapis.com/auth/gmail.modify",
    description: "Leia, redija e envie emails integrados às iniciativas",
  },
  {
    key: "drive",
    label: "Google Drive",
    icon: HardDrive,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    description: "Acesse arquivos e vincule pastas do Drive às iniciativas",
  },
];

const CeoGoogleIntegration = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [connections, setConnections] = useState<GoogleConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("google-auth", {
        body: { action: "status", user_id: user.id },
      });
      if (!error && data?.connections) {
        setConnections(data.connections);
      }
    } catch (e) {
      console.error("Error fetching Google status:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code && user) {
      const exchangeCode = async () => {
        setConnecting(true);
        try {
          const redirectUri = `${window.location.origin}/ceo/integracoes/google`;
          const { data, error } = await supabase.functions.invoke("google-auth", {
            body: {
              action: "exchange_code",
              code,
              redirect_uri: redirectUri,
              user_id: user.id,
            },
          });

          if (error) throw error;

          toast({
            title: "✅ Google conectado!",
            description: `Conta ${data.email} conectada com sucesso.`,
          });

          // Clean URL
          window.history.replaceState({}, "", window.location.pathname);
          await fetchStatus();
        } catch (e: any) {
          toast({ title: "Erro ao conectar", description: e.message, variant: "destructive" });
        } finally {
          setConnecting(false);
        }
      };
      exchangeCode();
    }
  }, [user]);

  const handleConnect = async () => {
    if (!user) return;
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/ceo/integracoes/google`;
      const { data, error } = await supabase.functions.invoke("google-auth", {
        body: { action: "get_auth_url", redirect_uri: redirectUri },
      });

      if (error) throw error;
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await supabase.functions.invoke("google-auth", {
        body: { action: "disconnect", connection_id: connectionId },
      });
      toast({ title: "Conta desconectada" });
      await fetchStatus();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleTest = async (service: string) => {
    if (!user) return;
    setTesting(service);
    try {
      const params: any = {};
      if (service === "calendar") {
        params.timeMin = new Date().toISOString();
        params.maxResults = 3;
      }

      const { data, error } = await supabase.functions.invoke("google-api", {
        body: {
          service,
          action: service === "calendar" ? "list_events" : service === "gmail" ? "list_messages" : "list_folders",
          params,
          user_id: user.id,
        },
      });

      if (error) throw error;

      const count = service === "calendar" ? data.events?.length :
        service === "gmail" ? data.messages?.length : data.folders?.length;

      toast({
        title: `✅ ${service === "calendar" ? "Calendar" : service === "gmail" ? "Gmail" : "Drive"} funcionando!`,
        description: `${count || 0} ${service === "calendar" ? "eventos" : service === "gmail" ? "emails" : "pastas"} encontrados.`,
      });
    } catch (e: any) {
      toast({ title: "Erro no teste", description: e.message, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const activeConnection = connections.find(c => c.status === "active");
  const hasScope = (scope: string) => activeConnection?.scopes?.includes(scope);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações Google</h1>
        <p className="text-muted-foreground text-sm">Conecte sua conta Google para acessar Calendar, Gmail e Drive pelo Sistema CEO.</p>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Conta Google</CardTitle>
                <CardDescription>
                  {activeConnection ? `Conectado como ${activeConnection.email}` : "Nenhuma conta conectada"}
                </CardDescription>
              </div>
            </div>
            <Badge variant={activeConnection ? "default" : "secondary"} className="gap-1">
              {activeConnection ? (
                <><CheckCircle2 className="h-3 w-3" /> Conectado</>
              ) : (
                <><XCircle className="h-3 w-3" /> Desconectado</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {activeConnection ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Conectado em:</span>
                  <p className="font-medium">
                    {format(new Date(activeConnection.connected_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Última sincronização:</span>
                  <p className="font-medium">
                    {activeConnection.last_sync_at
                      ? format(new Date(activeConnection.last_sync_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleConnect}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Reconectar
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDisconnect(activeConnection.id)}>
                  <Unlink className="h-4 w-4 mr-1" /> Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleConnect} disabled={connecting} className="w-full">
              {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
              Conectar conta Google
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Services */}
      {activeConnection && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Serviços autorizados</h2>
          <div className="grid gap-4">
            {SERVICE_MAP.map((svc) => {
              const connected = hasScope(svc.scope);
              return (
                <Card key={svc.key}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <svc.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{svc.label}</p>
                          <p className="text-sm text-muted-foreground">{svc.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={connected ? "default" : "secondary"} className="text-xs">
                          {connected ? "Autorizado" : "Não autorizado"}
                        </Badge>
                        {connected && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTest(svc.key)}
                            disabled={testing === svc.key}
                          >
                            {testing === svc.key ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Testar"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Security info */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Segurança</p>
              <p>Os tokens de acesso são armazenados de forma segura e renovados automaticamente.</p>
              <p>Você pode desconectar sua conta a qualquer momento.</p>
              <p>A IA sempre pedirá confirmação antes de enviar emails ou alterar sua agenda.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CeoGoogleIntegration;
