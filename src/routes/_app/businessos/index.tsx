import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { IconSpark, IconArrowRight } from "@/components/ui-custom/CustomIcon";
import { askCopilot } from "@/lib/businessos.functions";
import { useI18n } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/businessos/")({
  component: CommandCenter,
  head: () => ({
    meta: [
      { title: `AI Command Center — BusinessOS AI · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Ask one question in Uzbek, Russian or English — BusinessOS AI gathers market data, calculates and returns a ready answer.",
      },
      { property: "og:title", content: "AI Command Center — BusinessOS AI" },
      {
        property: "og:description",
        content: "One input for market prices, suppliers, finance and business plans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Turn = {
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  trace?: { tool: string; args: string; summary: string }[];
};

const EXAMPLES = [
  "Guruch narxi shu oyda o‘zgardimi?",
  "Eng arzon yetkazib beruvchini top va taklif tayyorla",
  "300 mln so‘m kredit, 24% yillik, 24 oy — oylik to‘lov qancha?",
];

function CommandCenter() {
  const { t, lang } = useI18n();
  const ask = useServerFn(askCopilot);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [openWhy, setOpenWhy] = useState<number | null>(null);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    const history = turns.map((x) => ({ role: x.role, content: x.content }));
    setTurns((prev) => [...prev, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await ask({ data: { question: q, lang, conversationId: convId, history } });
      setConvId(res.conversationId);
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, confidence: res.confidence, trace: res.trace },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <PageHexBadge hue={200} size={26} icon={<IconSpark size={22} />} aria-label="BusinessOS AI" />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("bos.name")}</div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{t("nav.command")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("bos.tagline")}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTurns([]);
              setConvId(null);
            }}
            className="rounded-full border border-glass-border bg-glass/40 px-3.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            {t("cc.newChat")}
          </button>
        </div>
      </div>

      <GlassPanel tier="strong" className="p-5">
        <div className="min-h-[240px] space-y-4">
          {turns.length === 0 && (
            <div className="space-y-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("cc.empty")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => void send(ex)}
                    className="rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  turn.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary/15 px-4 py-2.5 text-sm text-foreground"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm border border-glass-border bg-glass/40 px-4 py-3 text-sm"
                }
              >
                <div className="whitespace-pre-wrap leading-relaxed">{turn.content}</div>
                {turn.role === "assistant" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {typeof turn.confidence === "number" && (
                      <span className="rounded-full border border-glass-border px-2 py-0.5">
                        {t("cc.confidence")}: {Math.round(turn.confidence * 100)}%
                      </span>
                    )}
                    {turn.trace && turn.trace.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpenWhy(openWhy === i ? null : i)}
                        className="rounded-full border border-primary/40 px-2 py-0.5 text-primary"
                      >
                        {t("cc.why")}
                      </button>
                    )}
                  </div>
                )}
                {openWhy === i && turn.trace && (
                  <div className="mt-3 space-y-2 rounded-xl border border-glass-border bg-background/40 p-3">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {t("cc.sources")}
                    </div>
                    {turn.trace.map((step, k) => (
                      <div key={k} className="text-[11px] text-muted-foreground">
                        <span className="text-foreground">{step.tool}</span>
                        <span className="opacity-70"> ({step.args})</span>
                        <div className="mt-0.5 break-words opacity-70">{step.summary}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && <div className="text-xs text-muted-foreground">{t("cc.thinking")}</div>}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="mt-4 flex items-end gap-2 border-t border-glass-border pt-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            placeholder={t("cc.placeholder")}
            className="min-h-[56px] flex-1 resize-none rounded-xl border border-glass-border bg-background/40 px-4 py-3 text-sm outline-none focus:border-primary/50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t("cc.send")} <IconArrowRight size={14} />
          </button>
        </form>
      </GlassPanel>
    </div>
  );
}
