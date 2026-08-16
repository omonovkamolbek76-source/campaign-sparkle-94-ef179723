
-- Business profile ("enter once, use everywhere")
CREATE TABLE public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name text,
  brand_name text,
  inn text,
  sector text,
  region text,
  employees int,
  monthly_revenue numeric,
  monthly_costs numeric,
  tax_regime text,
  main_products text[] NOT NULL DEFAULT '{}',
  goals text,
  language text NOT NULL DEFAULT 'uz',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp view" ON public.business_profiles FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY "bp insert" ON public.business_profiles FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));
CREATE POLICY "bp update" ON public.business_profiles FOR UPDATE TO authenticated USING (is_org_member(org_id));
CREATE POLICY "bp delete" ON public.business_profiles FOR DELETE TO authenticated USING (has_org_role_any(org_id, ARRAY['owner'::org_role,'admin'::org_role]));
CREATE TRIGGER business_profiles_touch BEFORE UPDATE ON public.business_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Market data sources: daily vendors, TV, radio, web feeds
CREATE TABLE public.market_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'vendor',
  name text NOT NULL,
  region text,
  url text,
  schedule text NOT NULL DEFAULT 'daily',
  active boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_sources_org_idx ON public.market_sources(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_sources TO authenticated;
GRANT ALL ON public.market_sources TO service_role;
ALTER TABLE public.market_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms view" ON public.market_sources FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY "ms insert" ON public.market_sources FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));
CREATE POLICY "ms update" ON public.market_sources FOR UPDATE TO authenticated USING (is_org_member(org_id));
CREATE POLICY "ms delete" ON public.market_sources FOR DELETE TO authenticated USING (is_org_member(org_id));
CREATE TRIGGER market_sources_touch BEFORE UPDATE ON public.market_sources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Price / demand observations captured from those sources
CREATE TABLE public.market_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.market_sources(id) ON DELETE SET NULL,
  product text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'UZS',
  region text,
  demand_signal text,
  confidence numeric NOT NULL DEFAULT 0.7,
  source_label text,
  source_url text,
  note text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_obs_org_product_idx ON public.market_observations(org_id, product, observed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_observations TO authenticated;
GRANT ALL ON public.market_observations TO service_role;
ALTER TABLE public.market_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mo view" ON public.market_observations FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY "mo insert" ON public.market_observations FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));
CREATE POLICY "mo update" ON public.market_observations FOR UPDATE TO authenticated USING (is_org_member(org_id));
CREATE POLICY "mo delete" ON public.market_observations FOR DELETE TO authenticated USING (is_org_member(org_id));

-- Supplier offers for total-cost comparison
CREATE TABLE public.supplier_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product text NOT NULL,
  supplier text NOT NULL,
  price numeric NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  currency text NOT NULL DEFAULT 'UZS',
  min_qty numeric,
  delivery_cost numeric NOT NULL DEFAULT 0,
  delivery_days int,
  region text,
  quality_score numeric,
  contact text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supplier_offers_org_product_idx ON public.supplier_offers(org_id, product);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_offers TO authenticated;
GRANT ALL ON public.supplier_offers TO service_role;
ALTER TABLE public.supplier_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "so view" ON public.supplier_offers FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY "so insert" ON public.supplier_offers FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));
CREATE POLICY "so update" ON public.supplier_offers FOR UPDATE TO authenticated USING (is_org_member(org_id));
CREATE POLICY "so delete" ON public.supplier_offers FOR DELETE TO authenticated USING (is_org_member(org_id));

-- Copilot conversations
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv view" ON public.ai_conversations FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY "conv insert" ON public.ai_conversations FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));
CREATE POLICY "conv update" ON public.ai_conversations FOR UPDATE TO authenticated USING (is_org_member(org_id));
CREATE POLICY "conv delete" ON public.ai_conversations FOR DELETE TO authenticated USING (is_org_member(org_id));
CREATE TRIGGER ai_conversations_touch BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  tool_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_conv_idx ON public.ai_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg view" ON public.ai_messages FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY "msg insert" ON public.ai_messages FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));
CREATE POLICY "msg delete" ON public.ai_messages FOR DELETE TO authenticated USING (is_org_member(org_id));

-- Human-in-the-loop action approvals
CREATE TABLE public.ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  rationale text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric NOT NULL DEFAULT 0.6,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_actions_org_status_idx ON public.ai_actions(org_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_actions TO authenticated;
GRANT ALL ON public.ai_actions TO service_role;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "act view" ON public.ai_actions FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY "act insert" ON public.ai_actions FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));
CREATE POLICY "act update" ON public.ai_actions FOR UPDATE TO authenticated USING (is_org_member(org_id));
CREATE POLICY "act delete" ON public.ai_actions FOR DELETE TO authenticated USING (is_org_member(org_id));

-- Generated business plans
CREATE TABLE public.business_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  language text NOT NULL DEFAULT 'uz',
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_plans TO authenticated;
GRANT ALL ON public.business_plans TO service_role;
ALTER TABLE public.business_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan view" ON public.business_plans FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY "plan insert" ON public.business_plans FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));
CREATE POLICY "plan update" ON public.business_plans FOR UPDATE TO authenticated USING (is_org_member(org_id));
CREATE POLICY "plan delete" ON public.business_plans FOR DELETE TO authenticated USING (is_org_member(org_id));
CREATE TRIGGER business_plans_touch BEFORE UPDATE ON public.business_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Credit readiness / business health scores
CREATE TABLE public.business_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'credit',
  score int NOT NULL,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  advice text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_scores_org_idx ON public.business_scores(org_id, kind, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_scores TO authenticated;
GRANT ALL ON public.business_scores TO service_role;
ALTER TABLE public.business_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "score view" ON public.business_scores FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY "score insert" ON public.business_scores FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));
CREATE POLICY "score delete" ON public.business_scores FOR DELETE TO authenticated USING (is_org_member(org_id));
