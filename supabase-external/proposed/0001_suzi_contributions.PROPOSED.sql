-- STATUS: UNAPPLIED / PROPOSED — NOT APPROVED — DO NOT EXECUTE.
-- Target: external SUZI project (approved ref suumaiswxijllkkuybnz) ONLY. Never the Lovable Cloud project.
-- The external project is INACTIVE and its schema has NOT been inspected. This is a draft, not a
-- ready-to-run migration.
--
-- Required before any execution (owner B. approval needed for each):
--   1. Inspect the external schema; reconcile collisions with existing tables, columns, indexes,
--      sequences and functions (pinq_contributions, submission_rate_limits, user_roles, has_role).
--   2. Reconcile enum/type naming (public.app_role may already exist with other values).
--   3. Reconcile role model and RLS policies with existing external role registries; reuse, don't duplicate.
--   4. Review every GRANT and function EXECUTE right; no anon access to personal contribution rows.
--   5. SECURITY DEFINER functions: keep EXECUTE revoked from PUBLIC/anon, pin search_path, and
--      prefer a private non-exposed schema for role lookup after security review.
--   6. Re-run as a versioned, source-reviewed migration in the external project's own pipeline.
--
-- Provenance: derived from the Lovable-managed PROTOTYPE schema (drizzle/migrations), which is
-- legacy/prototype-only. The one prior test row there was deleted; no data to migrate.
-- Rights: contact permission is separate from dataset rights; nothing here grants training or
-- publication rights (see rights_status below).

CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
-- Do not leave SECURITY DEFINER callable by PUBLIC/anon. Re-review after schema inspection;
-- prefer a private (non-exposed) schema for role lookup if the external project allows it.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE TABLE public.pinq_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('suggest_source','offer_dataset','share_idea')),
  source_url text CHECK (source_url IS NULL OR char_length(source_url) <= 500),
  body text CHECK (body IS NULL OR char_length(body) <= 2000),
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 255),
  contact_permission boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','accepted','declined')),
  CHECK (contact_email IS NULL OR contact_permission = true),
  CHECK (kind <> 'offer_dataset' OR contact_email IS NOT NULL)
);
GRANT SELECT, UPDATE ON public.pinq_contributions TO authenticated;
GRANT ALL ON public.pinq_contributions TO service_role;
ALTER TABLE public.pinq_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read contributions" ON public.pinq_contributions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update contributions" ON public.pinq_contributions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.submission_rate_limits (
  id bigserial PRIMARY KEY,
  client_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submission_rate_limits_hash_time ON public.submission_rate_limits (client_hash, created_at);
GRANT ALL ON public.submission_rate_limits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.submission_rate_limits_id_seq TO service_role;
ALTER TABLE public.submission_rate_limits ENABLE ROW LEVEL SECURITY;

-- Addition for external target: dataset rights kept separate from contact permission.
ALTER TABLE public.pinq_contributions
  ADD COLUMN rights_status text NOT NULL DEFAULT 'unreviewed'
    CHECK (rights_status IN ('unreviewed','under_review','cleared_for_review_only','declined')),
  ADD COLUMN source_system text NOT NULL DEFAULT 'suzilabs_web_v1';
