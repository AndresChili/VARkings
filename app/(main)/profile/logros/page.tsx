import { createClient } from '@/lib/supabase/server';
import { LogrosClient } from '@/components/profile/logros-client';
import type { AchievementStats } from '@/components/profile/achievements-tab';

export default async function LogrosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, predsRes, tournamentRes, friendsRes, groupsRes, exactPredsRes] = await Promise.all([
    supabase.from('profiles').select('avatar_url').eq('id', user.id).single(),
    supabase
      .from('match_predictions')
      .select('points_total, is_calculated')
      .eq('user_id', user.id),
    supabase
      .from('tournament_predictions')
      .select('champion_points, runner_up_points, third_place_points, group_predictions_points, champion, group_predictions')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted'),
    supabase
      .from('groups')
      .select('id')
      .eq('created_by', user.id),
    supabase
      .from('match_predictions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('points_total', 3),
  ]);

  let maxGroupMembers = 0;
  if (groupsRes.data && groupsRes.data.length > 0) {
    const groupIds = groupsRes.data.map((g) => g.id);
    const { data: memberRows } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds);
    if (memberRows) {
      const counts: Record<string, number> = {};
      memberRows.forEach((m) => { counts[m.group_id] = (counts[m.group_id] ?? 0) + 1; });
      maxGroupMembers = Math.max(0, ...Object.values(counts));
    }
  }

  const preds = predsRes.data ?? [];
  const calculated = preds.filter((p) => p.is_calculated);
  const tp = tournamentRes.data;
  const tournamentPoints = tp
    ? (tp.champion_points ?? 0) + (tp.runner_up_points ?? 0) + (tp.third_place_points ?? 0) + (tp.group_predictions_points ?? 0)
    : 0;

  const stats: AchievementStats = {
    totalPredictions: preds.length,
    exactPredictions: exactPredsRes.count ?? 0,
    hasTournamentPrediction: !!(tp?.champion),
    groupPredictionsCount: tp?.group_predictions
      ? Object.keys(tp.group_predictions as Record<string, unknown>).length
      : 0,
    friendsCount: friendsRes.count ?? 0,
    groupsCreated: groupsRes.data?.length ?? 0,
    maxGroupMembers,
    totalPoints: calculated.reduce((sum, p) => sum + (p.points_total ?? 0), 0) + tournamentPoints,
    hasAvatar: !!(profileRes.data?.avatar_url),
  };

  return <LogrosClient stats={stats} />;
}
