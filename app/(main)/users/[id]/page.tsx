import { notFound, redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getUserXP, getUserStreakStats } from '@/lib/xp-server';
import { getLevelProgress } from '@/lib/xp';
import { getAchievements, type AchievementStats } from '@/lib/achievements';
import { isValidAvatarUrl } from '@/lib/avatar';
import { UserProfileClient } from '@/components/profile/user-profile-client';

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.id === id) redirect('/profile');

  const [profileRes, predsRes, tournamentRes, friendsRes, groupsRes, exactPredsRes, totalMatchCount, streakStats] = await Promise.all([
    supabase.from('profiles').select('id, username, full_name, avatar_url').eq('id', id).single(),
    supabase
      .from('match_predictions')
      .select('points_total, points_winner, points_home_score, points_away_score, is_calculated')
      .eq('user_id', id),
    supabase
      .from('tournament_predictions')
      .select('champion, runner_up, third_place, champion_points, runner_up_points, third_place_points, group_predictions_points, group_predictions, is_calculated')
      .eq('user_id', id)
      .maybeSingle(),
    supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .or(`requester_id.eq.${id},addressee_id.eq.${id}`)
      .eq('status', 'accepted'),
    supabase.from('groups').select('id').eq('created_by', id),
    supabase
      .from('match_predictions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)
      .eq('points_total', 3),
    supabase.from('matches').select('id', { count: 'exact', head: true }),
    (async () => {
      const admin = createAdminClient();
      return getUserStreakStats(admin, id);
    })(),
  ]);

  if (!profileRes.data) notFound();

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

  const admin = createAdminClient();
  const totalXP = await getUserXP(admin, id);
  const levelProgress = getLevelProgress(totalXP);

  const preds = predsRes.data ?? [];
  const calculated = preds.filter((p) => p.is_calculated);
  const tp = tournamentRes.data;
  const tournamentPoints = tp
    ? (tp.champion_points ?? 0) + (tp.runner_up_points ?? 0) + (tp.third_place_points ?? 0) + (tp.group_predictions_points ?? 0)
    : 0;
  const matchPoints = calculated.reduce((sum, p) => sum + (p.points_total ?? 0), 0) + tournamentPoints;
  const winnerHits = calculated.filter((p) => (p.points_winner ?? 0) > 0).length;
  const teamGoalHits = calculated.reduce((sum, p) => {
    return sum + ((p.points_home_score ?? 0) > 0 ? 1 : 0) + ((p.points_away_score ?? 0) > 0 ? 1 : 0);
  }, 0);

  const tpCalc = tp?.is_calculated ?? false;
  const podioExactHits = tpCalc
    ? ((tp!.champion_points ?? 0) === 20 ? 1 : 0) + ((tp!.runner_up_points ?? 0) === 10 ? 1 : 0) + ((tp!.third_place_points ?? 0) === 5 ? 1 : 0)
    : 0;
  const podioAnyHits = tpCalc
    ? ((tp!.champion_points ?? 0) === 3 ? 1 : 0) + ((tp!.runner_up_points ?? 0) === 3 ? 1 : 0) + ((tp!.third_place_points ?? 0) === 3 ? 1 : 0)
    : 0;

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

  const achievementStats: AchievementStats = {
    totalPredictions: preds.length,
    exactPredictions: exactPredsRes.count ?? 0,
    hasTournamentPrediction: !!(tp?.champion),
    groupPredictionsCount: tp?.group_predictions
      ? Object.keys(tp.group_predictions as Record<string, unknown>).length
      : 0,
    friendsCount: friendsRes.count ?? 0,
    groupsCreated: groupsRes.data?.length ?? 0,
    maxGroupMembers,
    totalPoints: matchPoints,
    totalXP,
    totalMatches: totalMatchCount.count ?? 0,
    hasAvatar: isValidAvatarUrl(profileRes.data.avatar_url),
    currentStreak: streakStats.currentStreak,
    maxStreak: streakStats.maxStreak,
    totalDaysActive: streakStats.totalDaysActive,
  };

  const completedAchievements = getAchievements(achievementStats).filter(
    (a) => a.current >= a.target
  );

  let initialFriendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none';
  if (user) {
    const { data: friendship } = await supabase
      .from('friendships')
      .select('requester_id, status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`
      )
      .maybeSingle();
    if (friendship) {
      if (friendship.status === 'accepted') initialFriendshipStatus = 'accepted';
      else if (friendship.requester_id === user.id) initialFriendshipStatus = 'pending_sent';
      else initialFriendshipStatus = 'pending_received';
    }
  }

  return (
    <UserProfileClient
      profile={profileRes.data}
      levelProgress={levelProgress}
      stats={{
        matchPoints,
        winnerHits,
        exactHits: exactPredsRes.count ?? 0,
        teamGoalHits,
        groupTeamsCorrect,
        podioExactHits,
        podioAnyHits,
      }}
      completedAchievements={completedAchievements}
      currentUserId={user?.id ?? null}
      targetUserId={id}
      initialFriendshipStatus={initialFriendshipStatus}
    />
  );
}
