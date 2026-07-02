-- Store penalty shootout scores separately from the match score.
-- football-data.org v4 reports fullTime including shootout goals, so the
-- app now stores the real match score in home_score/away_score and the
-- shootout result in these columns.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS away_penalties INTEGER;
