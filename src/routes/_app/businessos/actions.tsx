import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { IconCheck } from "@/components/ui-custom/CustomIcon";
import { useI18n } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/businessos/actions")({
  component: ActionsPage,
  head: () => ({
    meta: [
      { title: `Approval center — BusinessOS AI · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Every action BusinessOS AI proposes waits here for your approval, with its reasoning and confidence attached.",
      },
      { property: "og:title", content: "Approval center — BusinessOS AI" },
      {
        property: "og:description",
        content: "Human-in-the-loop review for AI-proposed business actions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Action = {
  id: string;
  kind: string;
  title: string;
  rationale: string | null;
  confidence: number;
  status: string;
  payload: unknown;
  created_at: string;
  decided_at: string | null;
};

function ActionsPage() {
  const { t } = useI18n();
  const orgId = useOrgId();
  const { user } = useAuth();
  const [rows, setRows] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("ai_actions")
      .select("id,kind,title,rationale,confidence,status,payload,created_at,decided_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as Action[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel("ai-actions-" + orgId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_actions", filter: `org_id=eq.${orgId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orgId, load]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    if (!user) return;
    await supabase
      .from("ai_actions")
      .update({ status, decided_by: user.id, decided_at: new Date().toISOString() })
      .eq("id", id);
    await load();
  };

  const list = rows.filter((r) => r.status === tab);
  const tabs: { key: typeof tab; label: string }[] = [
    { key: "pending", label: t("actions.pending") },
    { key: "approved", label: t("actions.approved") },
    { key: "rejected", label: t("actions.rejected") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <PageHexBadge hue={265} size={26} icon={<IconCheck size={22} />} aria-label={t("actions.title")} />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("bos.name")}</div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{t("actions.title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("actions.subtitle")}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            className={
              tab === x.key
                ? "rounded-full border border-primary/50 bg-primary/15 px-4 py-1.5 text-xs text-primary"
                : "rounded-full border border-glass-border bg-glass/40 px-4 py-1.5 text-xs text-muted-foreground"
            }
          >
            {x.label} ({rows.filter((r) => r.status === x.key).length})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <GlassPanel className="p-6 text-sm text-muted-foreground">{t("actions.none")}</GlassPanel>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <GlassPanel key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{a.kind}</div>
                  <h3 className="mt-1 font-display text-lg">{a.title}</h3>
                  {a.rationale && (
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{a.rationale}</p>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()} · {Math.round(Number(a.confidence) * 100)}%
                  </div>
                </div>
                {a.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void decide(a.id, "approved")}
                      className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                    >
                      {t("actions.approve")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide(a.id, "rejected")}
                      className="rounded-full border border-glass-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t("actions.reject")}
                    </button>
                  </div>
                )}
              </div>
              {a.payload != null && (
                <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-glass-border bg-background/30 p-3 text-[11px] text-muted-foreground">
                  {JSON.stringify(a.payload, null, 2)}
                </pre>
              )}
            </GlassPanel>
          ))}
        </div>
      )}
    </div>
  );
}
