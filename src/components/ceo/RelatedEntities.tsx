import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ceoStatusLabels, statusColors, CeoStatus } from "@/types/ceo";
import { ArrowRight } from "lucide-react";

interface RelatedItem {
  id: string;
  name: string;
  status?: string;
  type?: string;
  role?: string;
  extra?: string;
  link?: string;
}

interface RelationConfig {
  title: string;
  items: RelatedItem[];
}

interface RelatedEntitiesProps {
  entityType: "organization" | "stakeholder" | "product" | "project";
  entityId: string;
}

export const RelatedEntities = ({ entityType, entityId }: RelatedEntitiesProps) => {
  const navigate = useNavigate();
  const [relations, setRelations] = useState<RelationConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result: RelationConfig[] = [];

      if (entityType === "organization") {
        const [iniMain, iniPartner, iniPilot, products, stakeholders, revenues] = await Promise.all([
          (supabase as any).from("initiatives").select("id, name, status").eq("organization_id", entityId),
          (supabase as any).from("initiatives").select("id, name, status").eq("partner_organization_id", entityId),
          (supabase as any).from("initiatives").select("id, name, status").eq("pilot_organization_id", entityId),
          (supabase as any).from("products").select("id, name, status").eq("pilot_organization_id", entityId),
          (supabase as any).from("stakeholders").select("id, name, role_title, stakeholder_type").eq("organization_id", entityId),
          (supabase as any).from("revenues").select("id, description, status, organization_id").eq("organization_id", entityId),
        ]);

        const allInis = [
          ...(iniMain.data || []).map((i: any) => ({ ...i, role: "Organização principal" })),
          ...(iniPartner.data || []).map((i: any) => ({ ...i, role: "Parceiro" })),
          ...(iniPilot.data || []).map((i: any) => ({ ...i, role: "Piloto" })),
        ];
        if (allInis.length > 0) {
          result.push({
            title: `Iniciativas (${allInis.length})`,
            items: allInis.map(i => ({ id: i.id, name: i.name, status: i.status, role: i.role, link: `/ceo/iniciativas/${i.id}` })),
          });
        }
        if (products.data?.length) {
          result.push({
            title: `Produtos (${products.data.length})`,
            items: products.data.map((p: any) => ({ id: p.id, name: p.name, status: p.status, link: "/ceo/produtos" })),
          });
        }
        if (stakeholders.data?.length) {
          result.push({
            title: `Stakeholders (${stakeholders.data.length})`,
            items: stakeholders.data.map((s: any) => ({ id: s.id, name: s.name, extra: s.role_title, link: "/ceo/stakeholders" })),
          });
        }
      }

      if (entityType === "stakeholder") {
        const [iniLinks, org] = await Promise.all([
          (supabase as any).from("initiative_stakeholders").select("initiative_id, role, initiatives(id, name, status)").eq("stakeholder_id", entityId),
          (supabase as any).from("stakeholders").select("organization_id, organizations(id, name, type)").eq("id", entityId).single(),
        ]);
        if (iniLinks.data?.length) {
          result.push({
            title: `Iniciativas (${iniLinks.data.length})`,
            items: iniLinks.data.map((l: any) => ({
              id: l.initiatives?.id || l.initiative_id,
              name: l.initiatives?.name || "—",
              status: l.initiatives?.status,
              role: l.role,
              link: `/ceo/iniciativas/${l.initiative_id}`,
            })),
          });
        }
        if (org.data?.organizations) {
          result.push({
            title: "Organização",
            items: [{ id: org.data.organizations.id, name: org.data.organizations.name, type: org.data.organizations.type, link: "/ceo/organizacoes" }],
          });
        }
      }

      if (entityType === "product") {
        const [inis, projects, modules] = await Promise.all([
          (supabase as any).from("initiatives").select("id, name, status").or(`organization_id.eq.${entityId},partner_organization_id.eq.${entityId}`),
          (supabase as any).from("projects").select("id, name, status").eq("product_id", entityId),
          (supabase as any).from("modules").select("id, name").eq("origin_product_id", entityId),
        ]);
        // For products, query initiatives via strategic_asset link would be complex; show projects and modules
        if (projects.data?.length) {
          result.push({
            title: `Projetos (${projects.data.length})`,
            items: projects.data.map((p: any) => ({ id: p.id, name: p.name, status: p.status, link: "/ceo/projetos" })),
          });
        }
        if (modules.data?.length) {
          result.push({
            title: `Módulos (${modules.data.length})`,
            items: modules.data.map((m: any) => ({ id: m.id, name: m.name, link: "/ceo/modulos" })),
          });
        }
      }

      if (entityType === "project") {
        const [initiative, tasks, product] = await Promise.all([
          (supabase as any).from("projects").select("initiative_id, initiatives(id, name, status), product_id, products(id, name, status)").eq("id", entityId).single(),
          (supabase as any).from("ceo_tasks").select("id, title, status").eq("project_id", entityId),
          Promise.resolve(null), // placeholder
        ]);
        if (initiative.data?.initiatives) {
          result.push({
            title: "Iniciativa",
            items: [{ id: initiative.data.initiatives.id, name: initiative.data.initiatives.name, status: initiative.data.initiatives.status, link: `/ceo/iniciativas/${initiative.data.initiatives.id}` }],
          });
        }
        if (initiative.data?.products) {
          result.push({
            title: "Produto",
            items: [{ id: initiative.data.products.id, name: initiative.data.products.name, status: initiative.data.products.status, link: "/ceo/produtos" }],
          });
        }
        if (tasks.data?.length) {
          result.push({
            title: `Tarefas (${tasks.data.length})`,
            items: tasks.data.map((t: any) => ({ id: t.id, name: t.title, status: t.status, link: "/ceo/tarefas" })),
          });
        }
      }

      setRelations(result);
      setLoading(false);
    };
    if (entityId) load();
  }, [entityType, entityId]);

  if (loading) return <Skeleton className="h-32 w-full" />;
  if (relations.length === 0) return null;

  return (
    <div className="space-y-3 mt-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Vínculos</h3>
      {relations.map((rel, i) => (
        <Card key={i}>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">{rel.title}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="space-y-1.5">
              {rel.items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => item.link && navigate(item.link)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.role && <span className="text-xs text-muted-foreground">({item.role})</span>}
                    {item.extra && <span className="text-xs text-muted-foreground">· {item.extra}</span>}
                    {item.status && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[item.status as CeoStatus] || "bg-muted text-muted-foreground"}`}>
                        {ceoStatusLabels[item.status as CeoStatus] || item.status}
                      </Badge>
                    )}
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
