import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ceoStatusLabels, statusColors, CeoStatus, organizationTypeLabels, OrganizationType } from "@/types/ceo";
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
  entityType: "organization" | "stakeholder" | "product" | "project" | "initiative";
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
        const [iniMain, iniPartner, iniPilot, products, stakeholders, projects] = await Promise.all([
          (supabase as any).from("initiatives").select("id, name, status").eq("organization_id", entityId),
          (supabase as any).from("initiatives").select("id, name, status").eq("partner_organization_id", entityId),
          (supabase as any).from("initiatives").select("id, name, status").eq("pilot_organization_id", entityId),
          (supabase as any).from("products").select("id, name, status").eq("pilot_organization_id", entityId),
          (supabase as any).from("stakeholders").select("id, name, role_title, stakeholder_type").eq("organization_id", entityId),
          (supabase as any).from("projects").select("id, name, status, initiatives!projects_initiative_id_fkey(organization_id, partner_organization_id, pilot_organization_id)"),
        ]);

        const allInis = [
          ...(iniMain.data || []).map((i: any) => ({ ...i, role: "Organização principal" })),
          ...(iniPartner.data || []).map((i: any) => ({ ...i, role: "Parceiro" })),
          ...(iniPilot.data || []).map((i: any) => ({ ...i, role: "Piloto" })),
        ];
        // Deduplicate
        const uniqueInis = allInis.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        if (uniqueInis.length > 0) {
          result.push({
            title: `Iniciativas (${uniqueInis.length})`,
            items: uniqueInis.map(i => ({ id: i.id, name: i.name, status: i.status, role: i.role, link: `/ceo/iniciativas/${i.id}` })),
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
          const o = org.data.organizations;
          result.push({
            title: "Organização",
            items: [{ id: o.id, name: o.name, extra: organizationTypeLabels[o.type as OrganizationType] || o.type, link: "/ceo/organizacoes" }],
          });
        }
        // Projects via initiatives
        if (iniLinks.data?.length) {
          const iniIds = iniLinks.data.map((l: any) => l.initiative_id).filter(Boolean);
          const { data: projs } = await (supabase as any).from("projects").select("id, name, status").in("initiative_id", iniIds);
          if (projs?.length) {
            result.push({
              title: `Projetos (${projs.length})`,
              items: projs.map((p: any) => ({ id: p.id, name: p.name, status: p.status, link: "/ceo/projetos" })),
            });
          }
        }
      }

      if (entityType === "product") {
        const [projects, modules, inis] = await Promise.all([
          (supabase as any).from("projects").select("id, name, status").eq("product_id", entityId),
          (supabase as any).from("modules").select("id, name").eq("origin_product_id", entityId),
          (supabase as any).from("projects").select("initiative_id, initiatives(id, name, status)").eq("product_id", entityId),
        ]);
        // Initiatives via projects
        const uniqueInis = (inis.data || [])
          .filter((p: any) => p.initiatives)
          .map((p: any) => p.initiatives)
          .filter((v: any, i: number, a: any[]) => a.findIndex(t => t.id === v.id) === i);
        if (uniqueInis.length > 0) {
          result.push({
            title: `Iniciativas (${uniqueInis.length})`,
            items: uniqueInis.map((i: any) => ({ id: i.id, name: i.name, status: i.status, link: `/ceo/iniciativas/${i.id}` })),
          });
        }
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
        const [initiative, tasks] = await Promise.all([
          (supabase as any).from("projects").select("initiative_id, initiatives(id, name, status), product_id, products(id, name, status)").eq("id", entityId).single(),
          (supabase as any).from("ceo_tasks").select("id, title, status").eq("project_id", entityId),
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
        // Stakeholders via initiative
        if (initiative.data?.initiative_id) {
          const { data: stks } = await (supabase as any)
            .from("initiative_stakeholders")
            .select("stakeholder_id, role, stakeholders(id, name)")
            .eq("initiative_id", initiative.data.initiative_id);
          if (stks?.length) {
            result.push({
              title: `Stakeholders (${stks.length})`,
              items: stks.map((s: any) => ({ id: s.stakeholders?.id, name: s.stakeholders?.name || "—", role: s.role, link: "/ceo/stakeholders" })),
            });
          }
        }
      }

      if (entityType === "initiative") {
        const [orgs, stakeholderLinks, projects, asset] = await Promise.all([
          (supabase as any).from("initiatives").select("organization_id, partner_organization_id, pilot_organization_id, strategic_asset_id").eq("id", entityId).single(),
          (supabase as any).from("initiative_stakeholders").select("stakeholder_id, role, stakeholders(id, name, role_title)").eq("initiative_id", entityId),
          (supabase as any).from("projects").select("id, name, status, products(id, name, status)").eq("initiative_id", entityId),
          Promise.resolve(null),
        ]);

        // Organizations
        const orgIds = [orgs.data?.organization_id, orgs.data?.partner_organization_id, orgs.data?.pilot_organization_id].filter(Boolean);
        if (orgIds.length > 0) {
          const { data: orgData } = await (supabase as any).from("organizations").select("id, name, type, status").in("id", orgIds);
          if (orgData?.length) {
            const items = orgData.map((o: any) => {
              let role = "";
              if (o.id === orgs.data.organization_id) role = "Principal";
              if (o.id === orgs.data.partner_organization_id) role = "Parceiro";
              if (o.id === orgs.data.pilot_organization_id) role = "Piloto";
              return { id: o.id, name: o.name, status: o.status, role, link: "/ceo/organizacoes" };
            });
            result.push({ title: `Organizações (${items.length})`, items });
          }
        }

        // Stakeholders
        if (stakeholderLinks.data?.length) {
          result.push({
            title: `Stakeholders (${stakeholderLinks.data.length})`,
            items: stakeholderLinks.data.map((s: any) => ({
              id: s.stakeholders?.id || s.stakeholder_id,
              name: s.stakeholders?.name || "—",
              extra: s.stakeholders?.role_title,
              role: s.role,
              link: "/ceo/stakeholders",
            })),
          });
        }

        // Projects
        if (projects.data?.length) {
          result.push({
            title: `Projetos (${projects.data.length})`,
            items: projects.data.map((p: any) => ({ id: p.id, name: p.name, status: p.status, link: "/ceo/projetos" })),
          });
          // Products from projects
          const prods = projects.data.filter((p: any) => p.products).map((p: any) => p.products);
          const uniqueProds = prods.filter((p: any, i: number, a: any[]) => a.findIndex((x: any) => x.id === p.id) === i);
          if (uniqueProds.length > 0) {
            result.push({
              title: `Produtos (${uniqueProds.length})`,
              items: uniqueProds.map((p: any) => ({ id: p.id, name: p.name, status: p.status, link: "/ceo/produtos" })),
            });
          }
        }

        // Strategic Asset
        if (orgs.data?.strategic_asset_id) {
          const { data: sa } = await (supabase as any).from("strategic_assets").select("id, name, status, asset_type").eq("id", orgs.data.strategic_asset_id).single();
          if (sa) {
            result.push({
              title: "Ativo Estratégico",
              items: [{ id: sa.id, name: sa.name, status: sa.status, link: "/ceo/radar" }],
            });
          }
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.role && <span className="text-xs text-muted-foreground">({item.role})</span>}
                    {item.extra && <span className="text-xs text-muted-foreground">· {item.extra}</span>}
                    {item.status && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[item.status as CeoStatus] || "bg-muted text-muted-foreground"}`}>
                        {ceoStatusLabels[item.status as CeoStatus] || item.status}
                      </Badge>
                    )}
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
