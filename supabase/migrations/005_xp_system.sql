-- XP / leveling system

CREATE TABLE public.xp_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type TEXT        NOT NULL,
  source_id   TEXT        NOT NULL DEFAULT 'once',
  points      INTEGER     NOT NULL CHECK (points > 0),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id)
);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own events; all inserts come from server (admin client)
CREATE POLICY "xp_events_select_own" ON public.xp_events
  FOR SELECT USING (auth.uid() = user_id);
