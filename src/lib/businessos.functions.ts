import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAiQuota } from "@/lib/ai-quota.server";
import {
  extractObservations,
  generatePlanText,
  runCopilot,
  scoreCredit,
} from "@/lib/businessos-ai.server";

async function orgOf(sb: { from: (t: string) => any }, userId: string): Promise<string> {
  const { data } = await sb.from("org_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
  if (!data?.org_id) throw new Error("No workspace found for this user");
  return data.org_id as string;
}

/** One turn of the AI Command Center: think → tools → answer. */
export const askCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      question: string;
      lang: string;
      conversationId?: string | null;
      history?: { role: "user" | "assistant"; content: string }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "businessos-copilot");
    const orgId = await orgOf(context.supabase, context.userId);

    let conversationId = data.conversationId ?? null;
    if (!conversationId) {
      const { data: conv, error } = await context.supabase
        .from("ai_conversations")
        .insert({ org_id: orgId, created_by: context.userId, title: data.question.slice(0, 60) })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      conversationId = conv.id as string;
    }

    await context.supabase
      .from("ai_messages")
      .insert({ conversation_id: conversationId, org_id: orgId, role: "user", content: data.question });

    const result = await runCopilot({
      sb: context.supabase,
      orgId,
      userId: context.userId,
      lang: data.lang,
      history: data.history ?? [],
      question: data.question,
    });

    await context.supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      org_id: orgId,
      role: "assistant",
      content: result.answer,
      tool_trace: result.trace,
      confidence: result.confidence,
    });

    return { ...result, conversationId };
  });

/** Turn raw vendor speech / TV / radio transcript text into price observations. */
export const ingestMarketUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string; sourceId?: string | null; sourceLabel: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "businessos-ingest");
    const orgId = await orgOf(context.supabase, context.userId);
    const observations = await extractObservations(data.text, data.sourceLabel);
    if (observations.length === 0) return { inserted: 0 };

    const rows = observations.map((o) => ({
      org_id: orgId,
      source_id: data.sourceId ?? null,
      product: o.product,
      price: o.price,
      unit: o.unit || "kg",
      currency: o.currency || "UZS",
      region: o.region ?? null,
      demand_signal: o.demand_signal ?? null,
      confidence: typeof o.confidence === "number" ? Math.min(1, Math.max(0, o.confidence)) : 0.7,
      source_label: data.sourceLabel,
      note: o.note ?? null,
    }));
    const { error } = await context.supabase.from("market_observations").insert(rows);
    if (error) throw new Error(error.message);

    if (data.sourceId) {
      await context.supabase
        .from("market_sources")
        .update({ last_checked_at: new Date().toISOString(), last_status: `${rows.length} prices` })
        .eq("id", data.sourceId);
    }
    return { inserted: rows.length };
  });

/** Generate and store a bank-grade business plan. */
export const generateBusinessPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { idea: string; lang: string; title: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "businessos-plan");
    const orgId = await orgOf(context.supabase, context.userId);
    const { data: profile } = await context.supabase
      .from("business_profiles")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();
    const { data: obs } = await context.supabase
      .from("market_observations")
      .select("product,price,unit,currency,region,observed_at,source_label")
      .eq("org_id", orgId)
      .order("observed_at", { ascending: false })
      .limit(40);

    const content = await generatePlanText({
      lang: data.lang,
      profile: profile ?? null,
      idea: data.idea,
      marketNotes: JSON.stringify(obs ?? []),
    });

    const { data: plan, error } = await context.supabase
      .from("business_plans")
      .insert({
        org_id: orgId,
        created_by: context.userId,
        title: data.title || "Business plan",
        language: data.lang,
        inputs: { idea: data.idea },
        content,
      })
      .select("id,title,content,created_at")
      .single();
    if (error) throw new Error(error.message);
    return plan;
  });

/** Score credit readiness from the saved profile and recorded evidence. */
export const computeCreditScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lang: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "businessos-credit");
    const orgId = await orgOf(context.supabase, context.userId);
    const { data: profile } = await context.supabase
      .from("business_profiles")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();
    const { count: obsCount } = await context.supabase
      .from("market_observations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);
    const { count: planCount } = await context.supabase
      .from("business_plans")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);

    const result = await scoreCredit({
      lang: data.lang,
      profile: profile ?? null,
      observationCount: obsCount ?? 0,
      planCount: planCount ?? 0,
    });

    const score = Math.max(0, Math.min(100, Math.round(result.score)));
    const { data: row, error } = await context.supabase
      .from("business_scores")
      .insert({
        org_id: orgId,
        created_by: context.userId,
        kind: "credit",
        score,
        factors: result.factors,
        advice: result.advice,
      })
      .select("id,score,factors,advice,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
