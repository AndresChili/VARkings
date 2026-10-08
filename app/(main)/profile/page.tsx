import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ProfileClient } from '@/components/profile/profile-client';
import { getUserXP, computeAndAwardBonuses, getUserStreakStats } from '@/lib/xp-server';
import { isValidAvatarUrl } from '@/lib/avatar';
import { getLevelProgress } from '@/lib/xp';

type PredRow = {
  points_total: number;
  points_winner: number;
  points_home_score: number;
  points_away_score: number;
  is_calculated: boolean;
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [profileRes, predsRes, tournamentRes, friendsRes, groupsRes, exactPredsRes, groupStagePredCount, totalMatchCount, groupStageMatchCount, streakStats] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('match_predictions')
      .select('points_total, points_winner, points_home_score, points_away_score, is_calculated')
      .eq('user_id', user.id),
    supabase
      .from('tournament_predictions')
      .select('champion_points, runner_up_points, third_place_points, group_predictions_points, champion, group_predictions, is_calculated')
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
    supabase
      .from('match_predictions')
      .select('id, matches!inner(group_name)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('matches.group_name', 'is', null),
    supabase.from('matches').select('id', { count: 'exact', head: true }),
    supabase.from('matches').select('id', { count: 'exact', head: true }).not('group_name', 'is', null),
    getUserStreakStats(admin, user.id),
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

  const preds = (predsRes.data ?? []) as PredRow[];
  const calculated = preds.filter((p) => p.is_calculated);
  const tp = tournamentRes.data;
  const tournamentPoints = tp
    ? (tp.champion_points ?? 0) + (tp.runner_up_points ?? 0) + (tp.third_place_points ?? 0) + (tp.group_predictions_points ?? 0)
    : 0;

  const matchPoints = calculated.reduce((sum, p) => sum + (p.points_total ?? 0), 0) + tournamentPoints;
  const winnerHits = calculated.filter((p) => (p.points_winner ?? 0) > 0).length;
  const exactHits = exactPredsRes.count ?? 0;
  const teamGoalHits = calculated.reduce((sum, p) => {
    return sum + ((p.points_home_score ?? 0) > 0 ? 1 : 0) + ((p.points_away_score ?? 0) > 0 ? 1 : 0);
  }, 0);
  const tpCalc = tp?.is_calculated ?? false;

  let groupTeamsCorrect = 0;
  const userGroupPreds = tp?.group_predictions as Record<string, string[]> | null;
  if (userGroupPreds && Object.keys(userGroupPreds).length > 0) {
    const { data: groupMatches } = await supabase
      .from('matches')
      .select('home_team_name, away_team_name, home_score, away_score, group_name')
      .not('group_name', 'is', null)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    if (groupMatches?.length) {
      const pts: Record<string, Record<string, number>> = {};
      const gd: Record<string, Record<string, number>> = {};
      for (const m of groupMatches) {
        const g = m.group_name!;
        const hs = m.home_score!, as_ = m.away_score!;
        if (!m.home_team_name || !m.away_team_name) continue;
        pts[g] ??= {}; gd[g] ??= {};
        pts[g][m.home_team_name] ??= 0; gd[g][m.home_team_name] ??= 0;
        pts[g][m.away_team_name] ??= 0; gd[g][m.away_team_name] ??= 0;
        gd[g][m.home_team_name] += hs - as_;
        gd[g][m.away_team_name] += as_ - hs;
        if (hs > as_) pts[g][m.home_team_name] += 3;
        else if (as_ > hs) pts[g][m.away_team_name] += 3;
        else { pts[g][m.home_team_name] += 1; pts[g][m.away_team_name] += 1; }
      }
      for (const [group, predicted] of Object.entries(userGroupPreds)) {
        const groupPts = pts[group];
        if (!groupPts) continue;
        const qualifiers = Object.entries(groupPts)
          .sort((a, b) => b[1] - a[1] || (gd[group][b[0]] ?? 0) - (gd[group][a[0]] ?? 0))
          .slice(0, 2)
          .map(([t]) => t);
        groupTeamsCorrect += predicted.filter((t) => qualifiers.includes(t)).length;
      }
    }
  }
  const podioExactHits = tpCalc
    ? ((tp!.champion_points ?? 0) === 20 ? 1 : 0) + ((tp!.runner_up_points ?? 0) === 10 ? 1 : 0) + ((tp!.third_place_points ?? 0) === 5 ? 1 : 0)
    : 0;
  const podioAnyHits = tpCalc
    ? ((tp!.champion_points ?? 0) === 3 ? 1 : 0) + ((tp!.runner_up_points ?? 0) === 3 ? 1 : 0) + ((tp!.third_place_points ?? 0) === 3 ? 1 : 0)
    : 0;

  const stats = {
    totalPredictions: preds.length,
    calculatedPredictions: calculated.length,
    matchPoints,
    winnerHits,
    exactHits,
    teamGoalHits,
    groupTeamsCorrect,
    podioExactHits,
    podioAnyHits,
    tournamentPoints,
  };

  const achievementData = {
    friendsCount: friendsRes.count ?? 0,
    groupsCreated: groupsRes.data?.length ?? 0,
    maxGroupMembers,
    exactPredictions: exactPredsRes.count ?? 0,
    hasTournamentPrediction: !!(tp?.champion),
    groupPredictionsCount: tp?.group_predictions
      ? Object.keys(tp.group_predictions as Record<string, unknown>).length
      : 0,
    totalMatches: totalMatchCount.count ?? 0,
    currentStreak: streakStats.currentStreak,
    maxStreak: streakStats.maxStreak,
    totalDaysActive: streakStats.totalDaysActive,
  };

  const { data: earnedRows } = await admin
    .from('xp_events')
    .select('source_id')
    .eq('user_id', user.id)
    .eq('source_type', 'achievement');
  const earnedIds = (earnedRows ?? []).map((r: { source_id: string }) => r.source_id);

  // Calcula y otorga las bonificaciones automáticas de XP, luego obtiene el XP total
  await computeAndAwardBonuses(admin, user.id, {
    totalPredictions: preds.length,
    groupStagePredictions: groupStagePredCount.count ?? 0,
    totalGroupStageMatches: groupStageMatchCount.count ?? 0,
    totalMatches: totalMatchCount.count ?? 0,
    hasAvatar: isValidAvatarUrl(profileRes.data?.avatar_url),
    tournamentCalc: tp
      ? {
          is_calculated: tp.is_calculated ?? false,
          champion_points: tp.champion_points ?? null,
          runner_up_points: tp.runner_up_points ?? null,
          third_place_points: tp.third_place_points ?? null,
        }
      : null,
  });

  const totalXP = await getUserXP(admin, user.id);
  const levelProgress = getLevelProgress(totalXP);

  const isSuperadmin = !!process.env.SUPERADMIN_EMAIL && user.email?.toLowerCase() === process.env.SUPERADMIN_EMAIL.toLowerCase();
  const isOAuthUser = (user.identities ?? []).every((id) => id.provider !== 'email');

  let unreadSuggestions = 0;
  if (isSuperadmin) {
    const { count } = await admin
      .from('suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    unreadSuggestions = count ?? 0;
  }

  return (
    <ProfileClient
      profile={profileRes.data}
      stats={stats}
      achievementData={achievementData}
      levelProgress={levelProgress}
      email={user.email ?? ''}
      isSuperadmin={isSuperadmin}
      unreadSuggestions={unreadSuggestions}
      isOAuthUser={isOAuthUser}
      earnedIds={earnedIds}
    />
  );
}
