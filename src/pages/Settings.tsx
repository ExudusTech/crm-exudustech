import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PromptsTab from "@/components/settings/PromptsTab";
import GeneralSettingsTab from "@/components/settings/GeneralSettingsTab";

const Settings = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center gap-4 mb-6 md:mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Configurações</h1>
        </div>

        <Tabs defaultValue="prompts" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            <TabsTrigger value="general">Outras Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="prompts">
            <PromptsTab />
          </TabsContent>
          <TabsContent value="integracoes">
            <div className="space-y-4">
              <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/ceo/integracoes/google")}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Google Workspace</CardTitle>
                      <CardDescription>Calendar, Gmail e Drive integrados ao Sistema CEO</CardDescription>
                    </div>
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="general">
            <GeneralSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
