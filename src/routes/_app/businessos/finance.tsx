import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { IconFunnel } from "@/components/ui-custom/CustomIcon";
import { computeCreditScore, generateBusinessPlan } from "@/lib/businessos.functions";
import { useI18n } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/businessos/finance")({
  component: FinancePage,
  head: () => ({
    meta: [
      { title: `Finance agent — BusinessOS AI · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Generate a bank-grade business plan, score credit readiness and run loan math for your business in one place.",
      },
      { property: "og:title", content: "Finance agent — BusinessOS AI" },
      {
        property: "og:description",
        content: "Business plan, credit readiness score and loan calculator for Uzbek SMEs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Plan = { id: string; title: string; content: string; created_at: string };
type Score = {
  id: string;
  score: number;
  advice: string | null;
  factors: { label: string; impact: number; detail: string }[];
  created_at: string;
};

function FinancePage() {
  const { t, lang } = useI18n();
  const orgId = useOrgId();
  const genPlan = useServerFn(generateBusinessPlan);
  const genScore = useServerFn(computeCreditScore);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [score, setScore] = useState<Score | null>(null);
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [idea, setIdea] = useState("");
  const [title, setTitle] = useState("");
  const [busyPlan, setBusyPlan] = useState(false);
  const [busyScore, setBusyScore] = useState(false);

  const [amount, setAmount] = useState(300000000);
  const [rate, setRate] = useState(24);
  const [months, setMonths] = useState(24);

  const loan = useMemo(() => {
    const r = rate / 100 / 12;
    const monthly = r === 0 ? amount / months : (amount * r) / (1 - Math.pow(1 + r, -months));
    return {
      monthly: Math.round(monthly),
      interest: Math.round(monthly * months - amount),
    };
  }, [amount, rate, months]);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [p, s] = await Promise.all([
      supabase
        .from("business_plans")
        .select("id,title,content,created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("business_scores")
        .select("id,score,advice,factors,created_at")
        .eq("org_id", orgId)
        .eq("kind", "credit")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setPlans((p.data as Plan[]) ?? []);
    setScore((s.data as Score | null) ?? null);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createPlan = async () => {
    if (!idea.trim()) return;
    setBusyPlan(true);
    try {
      const plan = await genPlan({ data: { idea, lang, title: title.trim() || idea.slice(0, 50) } });
      toast.success(t("common.saved"));
      setIdea("");
      setTitle("");
      setOpenPlan(plan.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyPlan(false);
    }
  };

  const runScore = async () => {
    setBusyScore(true);
    try {
      await genScore({ data: { lang } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyScore(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <PageHexBadge hue={150} size={26} icon={<IconFunnel size={22} />} aria-label={t("fin.title")} />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("bos.name")}</div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{t("fin.title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("fin.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel tier="strong" className="p-5">
          <h2 className="font-display text-xl">{t("fin.credit")}</h2>
          {score ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-5xl">{score.score}</span>
                <span className="text-sm text-muted-foreground">/ 100 · {t("fin.score")}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-glass">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, score.score)}%` }}
                />
              </div>
              <ul className="space-y-2 text-sm">
                {(score.factors ?? []).map((f, i) => (
                  <li key={i} className="rounded-lg border border-glass-border bg-background/30 p-3">
                    <div className="flex items-center justify-between">
                      <span>{f.label}</span>
                      <span className={f.impact >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        {f.impact > 0 ? "+" : ""}
                        {f.impact}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
                  </li>
                ))}
              </ul>
              {score.advice && (
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground">{t("fin.advice")}: </span>
                  {score.advice}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("market.noData")}</p>
          )}
          <button
            type="button"
            onClick={() => void runScore()}
            disabled={busyScore}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busyScore ? t("common.generating") : t("common.generate")}
          </button>
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="font-display text-xl">{t("fin.calc")}</h2>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-muted-foreground">
              {t("fin.loanAmount")}
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-muted-foreground">
                {t("fin.rate")}
                <input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                {t("fin.months")}
                <input
                  type="number"
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
              </label>
            </div>
            <div className="rounded-xl border border-glass-border bg-background/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("fin.monthly")}</span>
                <span>{loan.monthly.toLocaleString()} UZS</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-muted-foreground">{t("fin.overpay")}</span>
                <span>{loan.interest.toLocaleString()} UZS</span>
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel tier="strong" className="p-5">
        <h2 className="font-display text-xl">{t("fin.plan")}</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Plan title"
          className="mt-3 w-full rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={5}
          placeholder="Toshkentda 200 m² non sexi ochmoqchiman, 500 mln so‘m kredit kerak…"
          className="mt-2 w-full resize-none rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
        <button
          type="button"
          onClick={() => void createPlan()}
          disabled={busyPlan || !idea.trim()}
          className="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busyPlan ? t("common.generating") : t("common.generate")}
        </button>
      </GlassPanel>

      {plans.length > 0 && (
        <GlassPanel className="p-5">
          <h2 className="font-display text-xl">{t("fin.plans")}</h2>
          <ul className="mt-3 space-y-2">
            {plans.map((p) => (
              <li key={p.id} className="rounded-xl border border-glass-border bg-background/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenPlan(openPlan === p.id ? null : p.id)}
                    className="rounded-full border border-glass-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t("common.open")}
                  </button>
                </div>
                {openPlan === p.id && (
                  <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                    {p.content}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}
    </div>
  );
}
