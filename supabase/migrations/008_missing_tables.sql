-- =====================================================
-- group_invites: invitaciones directas entre miembros
-- =====================================================

CREATE TABLE IF NOT EXISTS public.group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, invitee_id)
);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "group_invites_select" ON public.group_invites FOR SELECT USING (
    invitee_id = auth.uid() OR inviter_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "group_invites_insert" ON public.group_invites FOR INSERT WITH CHECK (
    inviter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_invites.group_id AND user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "group_invites_update" ON public.group_invites FOR UPDATE USING (
    invitee_id = auth.uid() OR inviter_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- join_requests: solicitudes de unión al grupo
-- =====================================================

CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "join_requests_select" ON public.join_requests FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = join_requests.group_id AND created_by = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "join_requests_insert" ON public.join_requests FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "join_requests_update" ON public.join_requests FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = join_requests.group_id AND created_by = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "join_requests_delete" ON public.join_requests FOR DELETE USING (
    user_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- group_tournament_predictions: predicciones de podio por grupo
-- =====================================================

CREATE TABLE IF NOT EXISTS public.group_tournament_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  champion TEXT,
  runner_up TEXT,
  third_place TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_tournament_predictions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "group_tournament_preds_select" ON public.group_tournament_predictions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_tournament_predictions.group_id AND user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "group_tournament_preds_insert" ON public.group_tournament_predictions FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_tournament_predictions.group_id AND user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "group_tournament_preds_update" ON public.group_tournament_predictions FOR UPDATE USING (
    user_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
