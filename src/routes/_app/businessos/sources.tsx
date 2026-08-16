import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { IconImport } from "@/components/ui-custom/CustomIcon";
import { useI18n } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/businessos/sources")({
  component: SourcesPage,
  head: () => ({
    meta: [
      { title: `Monitoring sources — BusinessOS AI · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Register the daily market vendors, TV channels and radio stations BusinessOS AI monitors for price and demand signals.",
      },
      { property: "og:title", content: "Monitoring sources — BusinessOS AI" },
      {
        property: "og:description",
        content: "Vendors, TV and radio feeds checked automatically every day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Source = {
  id: string;
  kind: string;
  name: string;
  region: string | null;
  url: string | null;
  active: boolean;
  last_checked_at: string | null;
  last_status: string | null;
};

const KINDS = ["vendor", "tv", "radio", "web"] as const;

function SourcesPage() {
  const { t } = useI18n();
  const orgId = useOrgId();
  const { user } = useAuth();
  const [rows, setRows] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<string>("vendor");
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [url, setUrl] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("market_sources")
      .select("id,kind,name,region,url,active,last_checked_at,last_status")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    setRows((data as Source[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!orgId || !user || !name.trim()) return;
    const { error } = await supabase.from("market_sources").insert({
      org_id: orgId,
      created_by: user.id,
      kind,
      name: name.trim(),
      region: region.trim() || null,
      url: url.trim() || null,
    });
    if (error) return toast.error(error.message);
    setName("");
    setRegion("");
    setUrl("");
    await load();
  };

  const toggle = async (s: Source) => {
    await supabase.from("market_sources").update({ active: !s.active }).eq("id", s.id);
    await load();
  };

  const remove = async (id: string) => {
    await supabase.from("market_sources").delete().eq("id", id);
    await load();
  };

  const kindLabel = (k: string) =>
    k === "vendor" ? t("sources.vendor") : k === "tv" ? t("sources.tv") : k === "radio" ? t("sources.radio") : t("sources.web");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <PageHexBadge hue={310} size={26} icon={<IconImport size={22} />} aria-label={t("sources.title")} />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("bos.name")}</div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{t("sources.title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("sources.subtitle")}</p>
        </div>
      </div>

      <GlassPanel tier="strong" className="p-5">
        <h2 className="font-display text-xl">{t("sources.add")}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chorsu bozori / O‘zbekiston 24"
            className="rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Toshkent"
            className="rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https:// feed, stream or transcript"
            className="rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
        </div>
        <button
          type="button"
          onClick={() => void add()}
          disabled={!name.trim()}
          className="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {t("common.add")}
        </button>
      </GlassPanel>

      <GlassPanel className="p-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("market.noData")}</p>
        ) : (
          <ul className="divide-y divide-glass-border">
            {rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm">
                    {s.name}
                    <span className="ml-2 rounded-full border border-glass-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {kindLabel(s.kind)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.region ?? "—"} · {t("sources.lastCheck")}:{" "}
                    {s.last_checked_at ? new Date(s.last_checked_at).toLocaleString() : t("sources.never")}
                    {s.last_status ? ` · ${s.last_status}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggle(s)}
                    className={
                      s.active
                        ? "rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-200"
                        : "rounded-full border border-glass-border px-3 py-1.5 text-xs text-muted-foreground"
                    }
                  >
                    {s.active ? "ON" : "OFF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(s.id)}
                    className="rounded-full border border-glass-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
