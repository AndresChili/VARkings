-- VARkings World Cup 2026 Quiniela App
-- Complete database schema with RLS policies

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- TABLES
-- =====================================================

-- Extended user profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- World Cup teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  logo_url TEXT,
  group_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiniela groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group membership
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- World Cup matches (synced from API-Football)
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER UNIQUE,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_team_logo TEXT,
  away_team_logo TEXT,
  home_team_api_id INTEGER,
  away_team_api_id INTEGER,
  match_date TIMESTAMPTZ NOT NULL,
  stage TEXT NOT NULL DEFAULT 'Group Stage',
  group_name TEXT,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT DEFAULT 'NS',
  venue TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament predictions (podio + phase groups - done once)
CREATE TABLE public.tournament_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  champion TEXT,
  runner_up TEXT,
  third_place TEXT,
  group_predictions JSONB DEFAULT '{}',
  champion_points INTEGER DEFAULT 0,
  runner_up_points INTEGER DEFAULT 0,
  third_place_points INTEGER DEFAULT 0,
  group_predictions_points INTEGER DEFAULT 0,
  is_calculated BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Per-match predictions
CREATE TABLE public.match_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  predicted_home_score INTEGER NOT NULL CHECK (predicted_home_score >= 0),
  predicted_away_score INTEGER NOT NULL CHECK (predicted_away_score >= 0),
  points_winner INTEGER DEFAULT 0,
  points_home_score INTEGER DEFAULT 0,
  points_away_score INTEGER DEFAULT 0,
  points_total INTEGER DEFAULT 0,
  is_calculated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- Points audit log
CREATE TABLE public.points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PWA push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_match_predictions_user_id ON public.match_predictions(user_id);
CREATE INDEX idx_match_predictions_match_id ON public.match_predictions(match_id);
CREATE INDEX idx_points_log_user_id ON public.points_log(user_id);
CREATE INDEX idx_matches_status ON public.matches(status);
CREATE INDEX idx_matches_match_date ON public.matches(match_date);
CREATE INDEX idx_groups_invite_code ON public.groups(invite_code);

-- =====================================================
-- VIEWS
-- =====================================================

-- Leaderboard per group
CREATE OR REPLACE VIEW public.group_leaderboard AS
SELECT
  gm.group_id,
  gm.user_id,
  p.username,
  p.full_name,
  p.avatar_url,
  COALESCE(SUM(mp.points_total), 0)
    + COALESCE(tp.champion_points, 0)
    + COALESCE(tp.runner_up_points, 0)
    + COALESCE(tp.third_place_points, 0)
    + COALESCE(tp.group_predictions_points, 0) AS total_points,
  COALESCE(COUNT(CASE WHEN mp.points_total > 0 AND mp.is_calculated THEN 1 END), 0) AS scored_matches,
  COALESCE(COUNT(CASE WHEN mp.is_calculated THEN 1 END), 0) AS calculated_matches,
  COALESCE(COUNT(mp.id), 0) AS total_predictions,
  COALESCE(tp.champion_points, 0) + COALESCE(tp.runner_up_points, 0)
    + COALESCE(tp.third_place_points, 0) AS podio_points,
  COALESCE(tp.group_predictions_points, 0) AS groups_points,
  COALESCE(SUM(mp.points_total), 0) AS matches_points
FROM public.group_members gm
JOIN public.profiles p ON p.id = gm.user_id
LEFT JOIN public.match_predictions mp ON mp.user_id = gm.user_id
LEFT JOIN public.tournament_predictions tp ON tp.user_id = gm.user_id
GROUP BY
  gm.group_id,
  gm.user_id,
  p.username,
  p.full_name,
  p.avatar_url,
  tp.champion_points,
  tp.runner_up_points,
  tp.third_place_points,
  tp.group_predictions_points;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-create profile on user signup
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

-- Update updated_at timestamp
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

-- Function to generate invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
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

-- Calculate match prediction points
CREATE OR REPLACE FUNCTION public.calculate_match_points(
  p_match_id UUID,
  p_home_score INTEGER,
  p_away_score INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pred RECORD;
  w_points INTEGER;
  h_points INTEGER;
  a_points INTEGER;
  total INTEGER;
  actual_winner TEXT;
  pred_winner TEXT;
BEGIN
  -- Determine actual winner
  actual_winner := CASE
    WHEN p_home_score > p_away_score THEN 'home'
    WHEN p_away_score > p_home_score THEN 'away'
    ELSE 'draw'
  END;

  FOR pred IN
    SELECT * FROM public.match_predictions
    WHERE match_id = p_match_id AND is_calculated = FALSE
  LOOP
    -- Determine predicted winner
    pred_winner := CASE
      WHEN pred.predicted_home_score > pred.predicted_away_score THEN 'home'
      WHEN pred.predicted_away_score > pred.predicted_home_score THEN 'away'
      ELSE 'draw'
    END;

    w_points := CASE WHEN pred_winner = actual_winner THEN 1 ELSE 0 END;
    h_points := CASE WHEN pred.predicted_home_score = p_home_score THEN 1 ELSE 0 END;
    a_points := CASE WHEN pred.predicted_away_score = p_away_score THEN 1 ELSE 0 END;
    total := w_points + h_points + a_points;

    UPDATE public.match_predictions
    SET
      points_winner = w_points,
      points_home_score = h_points,
      points_away_score = a_points,
      points_total = total,
      is_calculated = TRUE
    WHERE id = pred.id;

    -- Log points if any earned
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

  -- Mark match as having points calculated
  UPDATE public.matches SET status = 'FT' WHERE id = p_match_id;
END;
$$;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Teams (public read, admin write via service role)
CREATE POLICY "teams_select_all" ON public.teams FOR SELECT USING (TRUE);

-- Matches (public read, service role write)
CREATE POLICY "matches_select_all" ON public.matches FOR SELECT USING (TRUE);

-- Groups
CREATE POLICY "groups_select_member" ON public.groups FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = id AND user_id = auth.uid()
  )
);
CREATE POLICY "groups_insert_auth" ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = created_by AND auth.uid() IS NOT NULL);
CREATE POLICY "groups_update_creator" ON public.groups FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "groups_delete_creator" ON public.groups FOR DELETE USING (auth.uid() = created_by);

-- Group members
CREATE POLICY "group_members_select" ON public.group_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()
  )
);
CREATE POLICY "group_members_insert_own" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_members_delete_own" ON public.group_members FOR DELETE USING (auth.uid() = user_id);

-- Tournament predictions
CREATE POLICY "tournament_pred_select_own" ON public.tournament_predictions FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = tournament_predictions.user_id
  )
);
CREATE POLICY "tournament_pred_insert_own" ON public.tournament_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tournament_pred_update_own" ON public.tournament_predictions FOR UPDATE USING (auth.uid() = user_id);

-- Match predictions
CREATE POLICY "match_pred_select_own" ON public.match_predictions FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = match_predictions.user_id
  )
);
CREATE POLICY "match_pred_insert_own" ON public.match_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "match_pred_update_own" ON public.match_predictions FOR UPDATE USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND m.status = 'NS' AND m.match_date > NOW()
  )
);

-- Points log
CREATE POLICY "points_log_select_own" ON public.points_log FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = points_log.user_id
  )
);

-- Push subscriptions
CREATE POLICY "push_subs_own" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);
