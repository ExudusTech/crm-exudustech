import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import exudusLogo from "@/assets/exudus-logo.jpeg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <img src={exudusLogo} alt="ExudusTech" className="mx-auto h-24 w-24 sm:h-32 sm:w-32 mb-6 rounded-xl object-cover" />
        <h1 className="mb-4 text-2xl sm:text-4xl font-bold text-foreground">Sistema de Captura de Leads</h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-8">
          Capture leads automaticamente via email com CloudMailin
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Button size="lg" className="w-full sm:w-auto" onClick={() => navigate("/leads")}>
            Ver Leads Capturados
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => navigate("/configuracoes")}>
            <Settings className="mr-2 h-5 w-5" />
            Config
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
