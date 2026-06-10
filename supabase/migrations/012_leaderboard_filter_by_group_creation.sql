-- Fix: group leaderboard only counts match points for matches played AFTER group creation date.
-- Tournament predictions (champion, podio, group stage) are unaffected — they're pre-tournament.

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
    + COALESCE(tp.group_predictions_points, 0) AS total_points,
  COALESCE(COUNT(CASE WHEN mp.points_total > 0 AND mp.is_calculated AND m.match_date >= g.created_at THEN 1 END), 0) AS scored_matches,
  COALESCE(COUNT(CASE WHEN mp.is_calculated AND m.match_date >= g.created_at THEN 1 END), 0) AS calculated_matches,
  COALESCE(COUNT(CASE WHEN mp.id IS NOT NULL AND m.match_date >= g.created_at THEN 1 END), 0) AS total_predictions,
  COALESCE(tp.champion_points, 0) + COALESCE(tp.runner_up_points, 0)
    + COALESCE(tp.third_place_points, 0) AS podio_points,
  COALESCE(tp.group_predictions_points, 0) AS groups_points,
  COALESCE(SUM(CASE WHEN m.match_date >= g.created_at THEN mp.points_total ELSE 0 END), 0) AS matches_points
FROM public.group_members gm
JOIN public.groups g ON g.id = gm.group_id
JOIN public.profiles p ON p.id = gm.user_id
LEFT JOIN public.match_predictions mp ON mp.user_id = gm.user_id
LEFT JOIN public.matches m ON m.id = mp.match_id
LEFT JOIN public.tournament_predictions tp ON tp.user_id = gm.user_id
GROUP BY
  gm.group_id,
  gm.user_id,
  p.username,
  p.full_name,
  p.avatar_url,
  g.created_at,
  tp.champion_points,
  tp.runner_up_points,
  tp.third_place_points,
  tp.group_predictions_points;
