-- Podium (champion/runner_up/third_place) picks live per-group in
-- group_tournament_predictions (written by /api/groups/[id]/podio), but that
-- table never had points columns, and group_leaderboard was scoring podio
-- points off the unrelated, unused global tournament_predictions table
-- (always null — no UI links to it). Result: podium points never counted.

ALTER TABLE public.group_tournament_predictions
  ADD COLUMN champion_points   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN runner_up_points  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN third_place_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN is_calculated     BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE VIEW public.group_leaderboard AS
SELECT
  gm.group_id,
  gm.user_id,
  p.username,
  p.full_name,
  p.avatar_url,
  COALESCE(SUM(CASE WHEN m.match_date >= g.created_at THEN mp.points_total ELSE 0 END), 0)
    + COALESCE(gtp.champion_points, 0)
    + COALESCE(gtp.runner_up_points, 0)
    + COALESCE(gtp.third_place_points, 0)
    + COALESCE(tp.group_predictions_points, 0) AS total_points,
  COALESCE(COUNT(CASE WHEN mp.points_total > 0 AND mp.is_calculated AND m.match_date >= g.created_at THEN 1 END), 0) AS scored_matches,
  COALESCE(COUNT(CASE WHEN mp.is_calculated AND m.match_date >= g.created_at THEN 1 END), 0) AS calculated_matches,
  COALESCE(COUNT(CASE WHEN mp.id IS NOT NULL AND m.match_date >= g.created_at THEN 1 END), 0) AS total_predictions,
  COALESCE(gtp.champion_points, 0) + COALESCE(gtp.runner_up_points, 0)
    + COALESCE(gtp.third_place_points, 0) AS podio_points,
  COALESCE(tp.group_predictions_points, 0) AS groups_points,
  COALESCE(SUM(CASE WHEN m.match_date >= g.created_at THEN mp.points_total ELSE 0 END), 0) AS matches_points
FROM public.group_members gm
JOIN public.groups g ON g.id = gm.group_id
JOIN public.profiles p ON p.id = gm.user_id
LEFT JOIN public.match_predictions mp ON mp.user_id = gm.user_id
LEFT JOIN public.matches m ON m.id = mp.match_id
LEFT JOIN public.tournament_predictions tp ON tp.user_id = gm.user_id
LEFT JOIN public.group_tournament_predictions gtp
  ON gtp.user_id = gm.user_id AND gtp.group_id = gm.group_id
GROUP BY
  gm.group_id,
  gm.user_id,
  p.username,
  p.full_name,
  p.avatar_url,
  g.created_at,
  gtp.champion_points,
  gtp.runner_up_points,
  gtp.third_place_points,
  tp.group_predictions_points;
