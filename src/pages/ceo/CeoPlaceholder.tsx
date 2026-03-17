import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface CeoPlaceholderProps {
  title: string;
  description?: string;
}

const CeoPlaceholder = ({ title, description }: CeoPlaceholderProps) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      {description && <p className="text-muted-foreground text-sm mb-6">{description}</p>}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <Construction className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            Este módulo será implementado nas próximas etapas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CeoPlaceholder;
