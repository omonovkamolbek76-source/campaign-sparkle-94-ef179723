/**
 * BusinessOS AI — server-only model calls and agent tooling.
 *
 * Everything here runs behind a `createServerFn` boundary in
 * `src/lib/businessos.functions.ts`. The model never sees the API key and the
 * client never sees the prompts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const MODEL = "google/gemini-2.5-flash";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

export async function callAI(body: Record<string, unknown>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limited — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
    throw new Error(`AI gateway error (${res.status})`);
  }
  return (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
      };
    }>;
  };
}

export function toolArgs(json: Awaited<ReturnType<typeof callAI>>): Record<string, unknown> {
  const raw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!raw) throw new Error("AI returned no structured output");
  return JSON.parse(raw) as Record<string, unknown>;
}

export const LANG_LABEL: Record<string, string> = { uz: "Uzbek", ru: "Russian", en: "English" };

// ── Copilot tool catalogue ────────────────────────────────────────────────
export const COPILOT_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_business_profile",
      description: "Read the entrepreneur's saved business profile (sector, region, revenue, costs, products, tax regime).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "market_prices",
      description: "Recent observed market prices for a product, collected from daily vendors, TV and radio monitoring.",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string", description: "Product name, e.g. rice, cement, cotton yarn" },
          days: { type: "number", description: "Look-back window in days" },
        },
        required: ["product"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_suppliers",
      description: "Compare supplier offers for a product by total cost (price + delivery).",
      parameters: {
        type: "object",
        properties: { product: { type: "string" }, quantity: { type: "number" } },
        required: ["product"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finance_calc",
      description: "Loan and unit-economics math: monthly payment, total interest, margin, break-even.",
      parameters: {
        type: "object",
        properties: {
          loan_amount: { type: "number" },
          annual_rate: { type: "number" },
          months: { type: "number" },
          monthly_revenue: { type: "number" },
          monthly_costs: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_action",
      description:
        "Propose an action for the entrepreneur to approve (order from a supplier, adjust a price, contact a buyer, save a plan). Never acts by itself.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string" },
          title: { type: "string" },
          rationale: { type: "string" },
          confidence: { type: "number" },
          payload: { type: "object", additionalProperties: true },
        },
        required: ["kind", "title", "rationale"],
        additionalProperties: false,
      },
    },
  },
] as const;

export type ToolTraceEntry = { tool: string; args: Record<string, unknown>; result: unknown };

export function loanMath(amount: number, annualRate: number, months: number) {
  const r = annualRate / 100 / 12;
  const monthly = r === 0 ? amount / months : (amount * r) / (1 - Math.pow(1 + r, -months));
  return {
    monthly_payment: Math.round(monthly),
    total_paid: Math.round(monthly * months),
    total_interest: Math.round(monthly * months - amount),
  };
}

async function runTool(
  sb: SupabaseClient,
  orgId: string,
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "get_business_profile": {
      const { data } = await sb.from("business_profiles").select("*").eq("org_id", orgId).maybeSingle();
      return data ?? { note: "No business profile saved yet." };
    }
    case "market_prices": {
      const days = typeof args.days === "number" ? args.days : 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data } = await sb
        .from("market_observations")
        .select("product,price,unit,currency,region,observed_at,source_label,confidence,demand_signal")
        .eq("org_id", orgId)
        .ilike("product", `%${String(args.product ?? "")}%`)
        .gte("observed_at", since)
        .order("observed_at", { ascending: false })
        .limit(60);
      const rows = data ?? [];
      if (rows.length === 0) return { rows: [], note: "No observations recorded for this product yet." };
      const prices = rows.map((r) => Number(r.price));
      const half = Math.floor(rows.length / 2) || 1;
      const recent = prices.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const older = prices.slice(half).length
        ? prices.slice(half).reduce((a, b) => a + b, 0) / prices.slice(half).length
        : recent;
      return {
        count: rows.length,
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        min: Math.min(...prices),
        max: Math.max(...prices),
        change_pct: older ? Number((((recent - older) / older) * 100).toFixed(1)) : 0,
        rows: rows.slice(0, 12),
      };
    }
    case "compare_suppliers": {
      const qty = typeof args.quantity === "number" ? args.quantity : 1;
      const { data } = await sb
        .from("supplier_offers")
        .select("*")
        .eq("org_id", orgId)
        .ilike("product", `%${String(args.product ?? "")}%`)
        .limit(40);
      const offers = (data ?? []).map((o) => ({
        supplier: o.supplier,
        price: Number(o.price),
        unit: o.unit,
        currency: o.currency,
        delivery_days: o.delivery_days,
        total_cost: Math.round(Number(o.price) * qty + Number(o.delivery_cost ?? 0)),
        quality_score: o.quality_score,
        region: o.region,
        contact: o.contact,
      }));
      offers.sort((a, b) => a.total_cost - b.total_cost);
      return { quantity: qty, offers: offers.slice(0, 10) };
    }
    case "finance_calc": {
      const out: Record<string, unknown> = {};
      if (typeof args.loan_amount === "number" && typeof args.months === "number") {
        Object.assign(out, loanMath(args.loan_amount, Number(args.annual_rate ?? 0), args.months));
      }
      if (typeof args.monthly_revenue === "number" && typeof args.monthly_costs === "number") {
        const profit = args.monthly_revenue - args.monthly_costs;
        out.monthly_profit = Math.round(profit);
        out.margin_pct = args.monthly_revenue
          ? Number(((profit / args.monthly_revenue) * 100).toFixed(1))
          : null;
      }
      return Object.keys(out).length ? out : { note: "Not enough inputs to calculate." };
    }
    case "propose_action": {
      const { data, error } = await sb
        .from("ai_actions")
        .insert({
          org_id: orgId,
          created_by: userId,
          kind: String(args.kind ?? "generic"),
          title: String(args.title ?? "Proposed action"),
          rationale: String(args.rationale ?? ""),
          confidence: typeof args.confidence === "number" ? args.confidence : 0.6,
          payload: (args.payload as Record<string, unknown>) ?? {},
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      return { proposed: true, action_id: data.id, status: "pending_approval" };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

function systemPrompt(lang: string) {
  return `You are BusinessOS AI — an agentic business operating system for entrepreneurs in Uzbekistan.

Operating rules:
- Answer in ${LANG_LABEL[lang] ?? "Uzbek"}. Keep it short, concrete and numeric.
- THINK → gather data with tools → calculate → answer. Never invent prices, suppliers or statistics: if a tool returns no data, say so plainly and suggest adding a monitoring source.
- Always name where numbers came from (vendor observations, TV/radio monitoring, saved profile, your own math).
- Never execute a real-world action. When an action is warranted, call propose_action so the entrepreneur approves it.
- Ask at most one clarifying question, and only when the task is impossible otherwise.
- End with a one-line "why" that explains your reasoning in plain language.`;
}

export async function runCopilot(opts: {
  sb: SupabaseClient;
  orgId: string;
  userId: string;
  lang: string;
  history: { role: "user" | "assistant"; content: string }[];
  question: string;
}) {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(opts.lang) },
    ...opts.history.slice(-8).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: "user", content: opts.question },
  ];

  const trace: ToolTraceEntry[] = [];

  for (let step = 0; step < 6; step++) {
    const json = await callAI({ model: MODEL, messages, tools: COPILOT_TOOLS, tool_choice: "auto" });
    const msg = json.choices?.[0]?.message;
    const calls = msg?.tool_calls ?? [];

    if (calls.length === 0) {
      return {
        answer: msg?.content?.trim() || "…",
        trace,
        confidence: trace.length ? 0.82 : 0.6,
      };
    }

    messages.push({ role: "assistant", content: msg?.content ?? "", tool_calls: calls });

    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      const result = await runTool(opts.sb, opts.orgId, opts.userId, call.function.name, args);
      trace.push({ tool: call.function.name, args, result });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 6000) });
    }
  }

  return { answer: "I could not finish this task within the allowed steps.", trace, confidence: 0.3 };
}

// ── Market update extraction (vendor speech / TV / radio transcript) ──────
export async function extractObservations(text: string, sourceLabel: string) {
  const json = await callAI({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You extract structured market price observations from raw Uzbek/Russian/English text: market vendor speech, TV or radio broadcast transcripts, or price lists. Only extract what is explicitly stated. Never guess a price.",
      },
      { role: "user", content: `Source: ${sourceLabel}\n\nText:\n${text.slice(0, 12000)}` },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "return_observations",
          parameters: {
            type: "object",
            properties: {
              observations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product: { type: "string" },
                    price: { type: "number" },
                    unit: { type: "string" },
                    currency: { type: "string" },
                    region: { type: "string" },
                    demand_signal: { type: "string" },
                    confidence: { type: "number" },
                    note: { type: "string" },
                  },
                  required: ["product", "price", "unit"],
                  additionalProperties: false,
                },
              },
            },
            required: ["observations"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "return_observations" } },
  });
  const args = toolArgs(json) as {
    observations: Array<{
      product: string;
      price: number;
      unit: string;
      currency?: string;
      region?: string;
      demand_signal?: string;
      confidence?: number;
      note?: string;
    }>;
  };
  return args.observations ?? [];
}

// ── Business plan ─────────────────────────────────────────────────────────
export async function generatePlanText(input: {
  lang: string;
  profile: Record<string, unknown> | null;
  idea: string;
  marketNotes: string;
}) {
  const json = await callAI({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a bank-grade business plan writer for Uzbek SMEs. Write in ${LANG_LABEL[input.lang] ?? "Uzbek"}. Use Markdown with these sections: Rezyume, Mahsulot/Xizmat, Bozor tahlili, Raqobat, Marketing, Operatsiyalar, Moliyaviy prognoz (3 yil, jadval), Risklar, Kredit talabi. Use only the numbers given; where a number is unknown, mark it clearly as an assumption.`,
      },
      {
        role: "user",
        content: `Business profile: ${JSON.stringify(input.profile ?? {})}\n\nIdea / request: ${input.idea}\n\nObserved market data: ${input.marketNotes || "none recorded"}`,
      },
    ],
  });
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

// ── Credit readiness ──────────────────────────────────────────────────────
export async function scoreCredit(input: {
  lang: string;
  profile: Record<string, unknown> | null;
  observationCount: number;
  planCount: number;
}) {
  const json = await callAI({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You assess credit readiness of an Uzbek SME for a bank loan. Score 0-100. Be conservative and explain each factor. Write factor labels and advice in ${LANG_LABEL[input.lang] ?? "Uzbek"}.`,
      },
      {
        role: "user",
        content: `Profile: ${JSON.stringify(input.profile ?? {})}\nRecorded market observations: ${input.observationCount}\nSaved business plans: ${input.planCount}`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "return_score",
          parameters: {
            type: "object",
            properties: {
              score: { type: "number" },
              advice: { type: "string" },
              factors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    impact: { type: "number" },
                    detail: { type: "string" },
                  },
                  required: ["label", "impact", "detail"],
                  additionalProperties: false,
                },
              },
            },
            required: ["score", "advice", "factors"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "return_score" } },
  });
  return toolArgs(json) as {
    score: number;
    advice: string;
    factors: { label: string; impact: number; detail: string }[];
  };
}
