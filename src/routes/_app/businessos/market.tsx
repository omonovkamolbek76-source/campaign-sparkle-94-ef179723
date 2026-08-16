import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/hooks/use-org";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { IconChart } from "@/components/ui-custom/CustomIcon";
import { ingestMarketUpdate } from "@/lib/businessos.functions";
import { useI18n } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/businessos/market")({
  component: MarketPage,
  head: () => ({
    meta: [
      { title: `Market intelligence — BusinessOS AI · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Daily market prices collected from local vendors, TV and radio monitoring, with supplier total-cost comparison.",
      },
      { property: "og:title", content: "Market intelligence — BusinessOS AI" },
      {
        property: "og:description",
        content: "Track product prices, demand signals and the best supplier offer by total cost.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Observation = {
  id: string;
  product: string;
  price: number;
  unit: string;
  currency: string;
  region: string | null;
  demand_signal: string | null;
  source_label: string | null;
  confidence: number;
  observed_at: string;
};

type Offer = {
  id: string;
  product: string;
  supplier: string;
  price: number;
  unit: string;
  currency: string;
  delivery_cost: number;
  delivery_days: number | null;
  region: string | null;
  contact: string | null;
};

function MarketPage() {
  const { t } = useI18n();
  const orgId = useOrgId();
  const ingest = useServerFn(ingestMarketUpdate);

  const [obs, setObs] = useState<Observation[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState<string>("all");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [o, s] = await Promise.all([
      supabase
        .from("market_observations")
        .select("id,product,price,unit,currency,region,demand_signal,source_label,confidence,observed_at")
        .eq("org_id", orgId)
        .order("observed_at", { ascending: false })
        .limit(200),
      supabase
        .from("supplier_offers")
        .select("id,product,supplier,price,unit,currency,delivery_cost,delivery_days,region,contact")
        .eq("org_id", orgId)
        .limit(100),
    ]);
    setObs((o.data as Observation[]) ?? []);
    setOffers((s.data as Offer[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const products = useMemo(
    () => Array.from(new Set(obs.map((o) => o.product))).sort(),
    [obs],
  );

  const filtered = useMemo(
    () => (product === "all" ? obs : obs.filter((o) => o.product === product)),
    [obs, product],
  );

  const summary = useMemo(() => {
    const groups = new Map<string, Observation[]>();
    for (const o of filtered) {
      const arr = groups.get(o.product) ?? [];
      arr.push(o);
      groups.set(o.product, arr);
    }
    return Array.from(groups.entries()).map(([name, rows]) => {
      const prices = rows.map((r) => Number(r.price));
      const half = Math.floor(rows.length / 2) || 1;
      const recent = prices.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const tail = prices.slice(half);
      const older = tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : recent;
      return {
        name,
        count: rows.length,
        unit: rows[0].unit,
        currency: rows[0].currency,
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        min: Math.min(...prices),
        max: Math.max(...prices),
        change: older ? ((recent - older) / older) * 100 : 0,
      };
    });
  }, [filtered]);

  const bestOffers = useMemo(() => {
    const list = (product === "all" ? offers : offers.filter((o) => o.product === product)).map((o) => ({
      ...o,
      total: Number(o.price) + Number(o.delivery_cost ?? 0),
    }));
    return list.sort((a, b) => a.total - b.total).slice(0, 8);
  }, [offers, product]);

  const submitUpdate = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await ingest({ data: { text, sourceLabel: label.trim() || "Manual update" } });
      toast.success(`${res.inserted} → ${t("market.observations")}`);
      setText("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number, cur: string) => `${n.toLocaleString()} ${cur}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <PageHexBadge hue={40} size={26} icon={<IconChart size={22} />} aria-label={t("market.title")} />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("bos.name")}</div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{t("market.title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("market.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setProduct("all")}
          className={
            product === "all"
              ? "rounded-full border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs text-primary"
              : "rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-muted-foreground"
          }
        >
          {t("market.product")}: all
        </button>
        {products.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProduct(p)}
            className={
              product === p
                ? "rounded-full border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs text-primary"
                : "rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-muted-foreground"
            }
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : summary.length === 0 ? (
        <GlassPanel className="p-6 text-sm text-muted-foreground">{t("market.noData")}</GlassPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summary.map((s) => (
            <GlassPanel key={s.name} className="p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg">{s.name}</h3>
                <span
                  className={
                    s.change > 0.5
                      ? "text-xs text-rose-300"
                      : s.change < -0.5
                        ? "text-xs text-emerald-300"
                        : "text-xs text-muted-foreground"
                  }
                >
                  {s.change > 0 ? "+" : ""}
                  {s.change.toFixed(1)}%
                </span>
              </div>
              <div className="mt-3 text-2xl font-medium">{fmt(s.avg, s.currency)}</div>
              <div className="text-xs text-muted-foreground">
                {t("market.avg")} / {s.unit} · {s.count} {t("market.observations").toLowerCase()}
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>
                  {t("market.min")}: {s.min.toLocaleString()}
                </span>
                <span>
                  {t("market.max")}: {s.max.toLocaleString()}
                </span>
              </div>
            </GlassPanel>
          ))}
        </div>
      )}

      {bestOffers.length > 0 && (
        <GlassPanel className="p-5">
          <h2 className="font-display text-xl">{t("market.suppliers")}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">{t("market.suppliers")}</th>
                  <th className="py-2 text-left">{t("market.product")}</th>
                  <th className="py-2 text-right">{t("market.totalCost")}</th>
                  <th className="py-2 text-right">Days</th>
                </tr>
              </thead>
              <tbody>
                {bestOffers.map((o, i) => (
                  <tr key={o.id} className="border-t border-glass-border">
                    <td className="py-2">
                      {o.supplier}
                      {i === 0 && (
                        <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
                          {t("market.best")}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground">{o.product}</td>
                    <td className="py-2 text-right">{fmt(o.total, o.currency)}</td>
                    <td className="py-2 text-right text-muted-foreground">{o.delivery_days ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      )}

      <GlassPanel tier="strong" className="p-5">
        <h2 className="font-display text-xl">{t("market.ingest")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("market.ingestHint")}</p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Chorsu bozori · sotuvchi Anvar / UzReport TV 19:00"
          className="mt-3 w-full rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Bugun guruch 14 500 so‘m/kg, un 6 800 so‘m/kg, talab yuqori…"
          className="mt-2 w-full resize-none rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
        <button
          type="button"
          onClick={() => void submitUpdate()}
          disabled={busy || !text.trim()}
          className="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? t("common.saving") : t("common.add")}
        </button>
      </GlassPanel>

      {filtered.length > 0 && (
        <GlassPanel className="p-5">
          <h2 className="font-display text-xl">{t("market.observations")}</h2>
          <ul className="mt-3 divide-y divide-glass-border text-sm">
            {filtered.slice(0, 30).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="text-foreground">{o.product}</span>{" "}
                  <span className="text-muted-foreground">
                    {Number(o.price).toLocaleString()} {o.currency}/{o.unit}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {o.source_label ?? "—"} · {new Date(o.observed_at).toLocaleDateString()} ·{" "}
                  {Math.round(Number(o.confidence) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}
    </div>
  );
}
