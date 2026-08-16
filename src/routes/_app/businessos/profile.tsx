import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { IconWorkspace } from "@/components/ui-custom/CustomIcon";
import { useI18n } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/businessos/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: `Business profile — BusinessOS AI · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Tell BusinessOS AI about your company: sector, region, revenue, headcount and goals, so every answer is grounded in your reality.",
      },
      { property: "og:title", content: "Business profile — BusinessOS AI" },
      {
        property: "og:description",
        content: "The context BusinessOS AI uses for market, finance and planning answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Profile = {
  id?: string;
  legal_name: string;
  brand_name: string;
  inn: string;
  sector: string;
  region: string;
  employees: number;
  monthly_revenue: number;
  monthly_costs: number;
  tax_regime: string;
  main_products: string;
  goals: string;
};

const EMPTY: Profile = {
  legal_name: "",
  brand_name: "",
  inn: "",
  sector: "",
  region: "",
  employees: 0,
  monthly_revenue: 0,
  monthly_costs: 0,
  tax_regime: "",
  main_products: "",
  goals: "",
};

function ProfilePage() {
  const { t } = useI18n();
  const orgId = useOrgId();
  const { user } = useAuth();
  const [p, setP] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("business_profiles")
      .select("id,legal_name,brand_name,inn,sector,region,employees,monthly_revenue,monthly_costs,tax_regime,main_products,goals")
      .eq("org_id", orgId)
      .maybeSingle();
    if (data) {
      setP({
        id: data.id as string,
        legal_name: data.legal_name ?? "",
        brand_name: data.brand_name ?? "",
        inn: data.inn ?? "",
        sector: data.sector ?? "",
        region: data.region ?? "",
        employees: Number(data.employees ?? 0),
        monthly_revenue: Number(data.monthly_revenue ?? 0),
        monthly_costs: Number(data.monthly_costs ?? 0),
        tax_regime: data.tax_regime ?? "",
        main_products: (data.main_products ?? []).join(", "),
        goals: data.goals ?? "",
      });
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!orgId || !user) return;
    setSaving(true);
    const payload = {
      org_id: orgId,
      created_by: user.id,
      legal_name: p.legal_name,
      brand_name: p.brand_name,
      inn: p.inn,
      sector: p.sector,
      region: p.region,
      employees: p.employees,
      monthly_revenue: p.monthly_revenue,
      monthly_costs: p.monthly_costs,
      tax_regime: p.tax_regime,
      main_products: p.main_products.split(",").map((x) => x.trim()).filter(Boolean),
      goals: p.goals,
    };
    const { error } = p.id
      ? await supabase.from("business_profiles").update(payload).eq("id", p.id)
      : await supabase.from("business_profiles").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("common.saved"));
    await load();
  };

  const field = (label: string, key: keyof Profile, type: "text" | "number" = "text") => (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input
        type={type}
        value={String(p[key] ?? "")}
        onChange={(e) =>
          setP({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value })
        }
        className="mt-1 w-full rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
      />
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <PageHexBadge hue={200} size={26} icon={<IconWorkspace size={22} />} aria-label={t("profile.title")} />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("bos.name")}</div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{t("profile.title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("profile.subtitle")}</p>
        </div>
      </div>

      <GlassPanel tier="strong" className="p-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {field(t("profile.legalName"), "legal_name")}
              {field(t("profile.brandName"), "brand_name")}
              {field(t("profile.inn"), "inn")}
              {field(t("profile.sector"), "sector")}
              {field(t("profile.region"), "region")}
              {field(t("profile.employees"), "employees", "number")}
              {field(t("profile.revenue"), "monthly_revenue", "number")}
              {field(t("profile.costs"), "monthly_costs", "number")}
              {field(t("profile.taxRegime"), "tax_regime")}
              {field(t("profile.products"), "main_products")}
            </div>
            <label className="mt-3 block text-xs text-muted-foreground">
              {t("profile.goals")}
              <textarea
                value={p.goals}
                rows={3}
                onChange={(e) => setP({ ...p, goals: e.target.value })}
                className="mt-1 w-full resize-none rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </label>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </>
        )}
      </GlassPanel>
    </div>
  );
}
