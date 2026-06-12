-- VARkings World Cup 2026 — Full consolidated schema
-- Incorporates migrations 001-012. Run on a fresh Supabase project.

-- =====================================================
-- EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- TABLES
-- =====================================================

-- Extended user profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL,
  full_name    TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- World Cup teams
CREATE TABLE public.teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id       INTEGER UNIQUE,
  name         TEXT NOT NULL,
  short_name   TEXT,
  logo_url     TEXT,
  group_name   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Quiniela groups
CREATE TABLE public.groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  invite_code  TEXT UNIQUE NOT NULL,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Group membership
CREATE TABLE public.group_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- World Cup matches (synced from API-Football)
-- home/away team names are nullable for undecided knockout slots
CREATE TABLE public.matches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id            INTEGER UNIQUE,
  home_team_name    TEXT,
  away_team_name    TEXT,
  home_team_logo    TEXT,
  away_team_logo    TEXT,
  home_team_api_id  INTEGER,
  away_team_api_id  INTEGER,
  match_date        TIMESTAMPTZ NOT NULL,
  stage             TEXT NOT NULL DEFAULT 'Group Stage',
  group_name        TEXT,
  home_score        INTEGER,
  away_score        INTEGER,
  winner_team_name  TEXT,
  status            TEXT DEFAULT 'NS',
  venue             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Global tournament predictions: podio + group-stage qualifiers (once per user)
CREATE TABLE public.tournament_predictions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  champion                 TEXT,
  runner_up                TEXT,
  third_place              TEXT,
  group_predictions        JSONB DEFAULT '{}',
  champion_points          INTEGER DEFAULT 0,
  runner_up_points         INTEGER DEFAULT 0,
  third_place_points       INTEGER DEFAULT 0,
  group_predictions_points INTEGER DEFAULT 0,
  is_calculated            BOOLEAN DEFAULT FALSE,
  submitted_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Per-match predictions
-- predicted_winner tracks penalty-shootout winner for drawn knockout matches
CREATE TABLE public.match_predictions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id              UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  predicted_home_score  INTEGER NOT NULL CHECK (predicted_home_score >= 0),
  predicted_away_score  INTEGER NOT NULL CHECK (predicted_away_score >= 0),
  predicted_winner      TEXT,
  points_winner         INTEGER DEFAULT 0,
  points_home_score     INTEGER DEFAULT 0,
  points_away_score     INTEGER DEFAULT 0,
  points_total          INTEGER DEFAULT 0,
  is_calculated         BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- Points audit log
CREATE TABLE public.points_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id    UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  points      INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- PWA push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT,
  auth_key   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Friends / connections
CREATE TABLE public.friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- XP leveling system (independent of quiniela points)
-- All inserts go through admin client; unique constraint makes awards idempotent
CREATE TABLE public.xp_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id   TEXT NOT NULL DEFAULT 'once',
  points      INTEGER NOT NULL CHECK (points > 0),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id)
);

-- User suggestions / feedback
CREATE TABLE public.suggestions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject    TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Direct group invites between members
CREATE TABLE public.group_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, invitee_id)
);

-- Join requests for groups
CREATE TABLE public.join_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Per-group podio predictions (independent per quiniela group)
CREATE TABLE public.group_tournament_predictions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  champion    TEXT,
  runner_up   TEXT,
  third_place TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_group_members_group_id        ON public.group_members(group_id);
CREATE INDEX idx_group_members_user_id         ON public.group_members(user_id);
CREATE INDEX idx_match_predictions_user_id     ON public.match_predictions(user_id);
CREATE INDEX idx_match_predictions_match_id    ON public.match_predictions(match_id);
CREATE INDEX idx_points_log_user_id            ON public.points_log(user_id);
CREATE INDEX idx_matches_status                ON public.matches(status);
CREATE INDEX idx_matches_match_date            ON public.matches(match_date);
CREATE INDEX idx_groups_invite_code            ON public.groups(invite_code);
CREATE INDEX idx_friendships_requester         ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee         ON public.friendships(addressee_id);
CREATE INDEX idx_friendships_status            ON public.friendships(status);

-- =====================================================
-- STORAGE
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- SECURITY DEFINER helper: avoids infinite RLS recursion on group_members / groups
CREATE OR REPLACE FUNCTION public.current_user_is_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$;

-- Auto-create profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9]', '_', 'g'))
    ),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generic updated_at stamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER match_predictions_updated_at
  BEFORE UPDATE ON public.match_predictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER tournament_predictions_updated_at
  BEFORE UPDATE ON public.tournament_predictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER group_tournament_predictions_updated_at
  BEFORE UPDATE ON public.group_tournament_predictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Generate a unique 8-char uppercase invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code         TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS (SELECT 1 FROM public.groups WHERE invite_code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$;

-- Score all predictions for a finished match and write to points_log
CREATE OR REPLACE FUNCTION public.calculate_match_points(
  p_match_id   UUID,
  p_home_score INTEGER,
  p_away_score INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pred          RECORD;
  w_points      INTEGER;
  h_points      INTEGER;
  a_points      INTEGER;
  total         INTEGER;
  actual_winner TEXT;
  pred_winner   TEXT;
BEGIN
  actual_winner := CASE
    WHEN p_home_score > p_away_score THEN 'home'
    WHEN p_away_score > p_home_score THEN 'away'
    ELSE 'draw'
  END;

  FOR pred IN
    SELECT * FROM public.match_predictions
    WHERE match_id = p_match_id AND is_calculated = FALSE
  LOOP
    pred_winner := CASE
      WHEN pred.predicted_home_score > pred.predicted_away_score THEN 'home'
      WHEN pred.predicted_away_score > pred.predicted_home_score THEN 'away'
      ELSE 'draw'
    END;

    w_points := CASE WHEN pred_winner = actual_winner THEN 1 ELSE 0 END;
    h_points := CASE WHEN pred.predicted_home_score = p_home_score THEN 1 ELSE 0 END;
    a_points := CASE WHEN pred.predicted_away_score = p_away_score THEN 1 ELSE 0 END;
    total    := w_points + h_points + a_points;

    UPDATE public.match_predictions
    SET
      points_winner     = w_points,
      points_home_score = h_points,
      points_away_score = a_points,
      points_total      = total,
      is_calculated     = TRUE
    WHERE id = pred.id;

    IF total > 0 THEN
      INSERT INTO public.points_log (user_id, match_id, points, reason, description)
      VALUES (
        pred.user_id,
        p_match_id,
        total,
        'match_prediction',
        format('Predicción de partido: %s puntos (ganador: %s, goles local: %s, goles visitante: %s)',
          total, w_points, h_points, a_points)
      );
    END IF;
  END LOOP;

  UPDATE public.matches SET status = 'FT' WHERE id = p_match_id;
END;
$$;

-- =====================================================
-- VIEWS
-- =====================================================

-- Per-group leaderboard. Match points only count for matches played AFTER
-- the group was created; podio/group-stage prediction points are always included.
CREATE OR REPLACE VIEW public.group_leaderboard AS
SELECT
  gm.group_id,
  gm.user_id,
  p.username,
  p.full_name,
  p.avatar_url,
  COALESCE(SUM(CASE WHEN m.match_date >= g.created_at THEN mp.points_total ELSE 0 END), 0)
    + COALESCE(tp.champion_points, 0)
    + COALESCE(tp.runner_up_points, 0)
    + COALESCE(tp.third_place_points, 0)
    + COALESCE(tp.group_predictions_points, 0)                                                 AS total_points,
  COALESCE(COUNT(CASE WHEN mp.points_total > 0 AND mp.is_calculated AND m.match_date >= g.created_at THEN 1 END), 0) AS scored_matches,
  COALESCE(COUNT(CASE WHEN mp.is_calculated AND m.match_date >= g.created_at THEN 1 END), 0)  AS calculated_matches,
  COALESCE(COUNT(CASE WHEN mp.id IS NOT NULL AND m.match_date >= g.created_at THEN 1 END), 0) AS total_predictions,
  COALESCE(tp.champion_points, 0)
    + COALESCE(tp.runner_up_points, 0)
    + COALESCE(tp.third_place_points, 0)                                                       AS podio_points,
  COALESCE(tp.group_predictions_points, 0)                                                     AS groups_points,
  COALESCE(SUM(CASE WHEN m.match_date >= g.created_at THEN mp.points_total ELSE 0 END), 0)    AS matches_points
FROM public.group_members gm
JOIN public.groups g              ON g.id  = gm.group_id
JOIN public.profiles p            ON p.id  = gm.user_id
LEFT JOIN public.match_predictions mp  ON mp.user_id = gm.user_id
LEFT JOIN public.matches m             ON m.id = mp.match_id
LEFT JOIN public.tournament_predictions tp ON tp.user_id = gm.user_id
GROUP BY
  gm.group_id, gm.user_id,
  p.username, p.full_name, p.avatar_url,
  g.created_at,
  tp.champion_points, tp.runner_up_points, tp.third_place_points, tp.group_predictions_points;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_predictions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_predictions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_log                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invites               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tournament_predictions ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_all"  ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- teams / matches: public read, service role writes
CREATE POLICY "teams_select_all"   ON public.teams   FOR SELECT USING (TRUE);
CREATE POLICY "matches_select_all" ON public.matches FOR SELECT USING (TRUE);

-- groups (uses helper to avoid infinite recursion)
CREATE POLICY "groups_select_member"  ON public.groups FOR SELECT USING (
  created_by = auth.uid() OR public.current_user_is_group_member(id)
);
CREATE POLICY "groups_insert_auth"    ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = created_by AND auth.uid() IS NOT NULL);
CREATE POLICY "groups_update_creator" ON public.groups FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "groups_delete_creator" ON public.groups FOR DELETE USING (auth.uid() = created_by);

-- group_members (uses helper to avoid infinite recursion)
CREATE POLICY "group_members_select"      ON public.group_members FOR SELECT USING (
  user_id = auth.uid() OR public.current_user_is_group_member(group_id)
);
CREATE POLICY "group_members_insert_own"  ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_members_delete_own"  ON public.group_members FOR DELETE USING (auth.uid() = user_id);

-- tournament_predictions
CREATE POLICY "tournament_pred_select" ON public.tournament_predictions FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = tournament_predictions.user_id
  )
);
CREATE POLICY "tournament_pred_insert" ON public.tournament_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tournament_pred_update" ON public.tournament_predictions FOR UPDATE USING (auth.uid() = user_id);

-- match_predictions
CREATE POLICY "match_pred_select" ON public.match_predictions FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = match_predictions.user_id
  )
);
CREATE POLICY "match_pred_insert" ON public.match_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "match_pred_update" ON public.match_predictions FOR UPDATE USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND m.status = 'NS' AND m.match_date > NOW()
  )
);

-- points_log
CREATE POLICY "points_log_select" ON public.points_log FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = points_log.user_id
  )
);

-- push_subscriptions
CREATE POLICY "push_subs_own" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- friendships
CREATE POLICY "friendships_select" ON public.friendships FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id
);
CREATE POLICY "friendships_insert" ON public.friendships FOR INSERT WITH CHECK (
  auth.uid() = requester_id
);
CREATE POLICY "friendships_update" ON public.friendships FOR UPDATE USING (
  auth.uid() = addressee_id AND status = 'pending'
);
CREATE POLICY "friendships_delete" ON public.friendships FOR DELETE USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id
);

-- xp_events: read own; writes only via server admin client
CREATE POLICY "xp_events_select_own" ON public.xp_events FOR SELECT USING (auth.uid() = user_id);

-- suggestions: authenticated insert; admin reads via service role
CREATE POLICY "suggestions_insert_own" ON public.suggestions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- group_invites
CREATE POLICY "group_invites_select" ON public.group_invites FOR SELECT USING (
  invitee_id = auth.uid() OR inviter_id = auth.uid()
);
CREATE POLICY "group_invites_insert" ON public.group_invites FOR INSERT WITH CHECK (
  inviter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = group_invites.group_id AND user_id = auth.uid()
  )
);
CREATE POLICY "group_invites_update" ON public.group_invites FOR UPDATE USING (
  invitee_id = auth.uid() OR inviter_id = auth.uid()
);

-- join_requests
CREATE POLICY "join_requests_select" ON public.join_requests FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.groups WHERE id = join_requests.group_id AND created_by = auth.uid()
  )
);
CREATE POLICY "join_requests_insert" ON public.join_requests FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY "join_requests_update" ON public.join_requests FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.groups WHERE id = join_requests.group_id AND created_by = auth.uid()
  )
);
CREATE POLICY "join_requests_delete" ON public.join_requests FOR DELETE USING (
  user_id = auth.uid()
);

-- group_tournament_predictions
CREATE POLICY "group_tp_select" ON public.group_tournament_predictions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = group_tournament_predictions.group_id AND user_id = auth.uid()
  )
);
CREATE POLICY "group_tp_insert" ON public.group_tournament_predictions FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = group_tournament_predictions.group_id AND user_id = auth.uid()
  )
);
CREATE POLICY "group_tp_update" ON public.group_tournament_predictions FOR UPDATE USING (
  user_id = auth.uid()
);

-- =====================================================
-- STORAGE POLICIES (avatars bucket)
-- =====================================================

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name = (auth.uid()::text || '.jpg'));

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND name = (auth.uid()::text || '.jpg'));

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');
