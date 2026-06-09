import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAchievements, type AchievementStats } from '@/lib/achievements';
import { getUserXP, awardXP, getUserStreakStats } from '@/lib/xp-server';
import { isValidAvatarUrl } from '@/lib/avatar';
import { XP_VALUES } from '@/lib/xp';

const ACHIEVEMENT_XP: Record<string, number> = {
  easy: XP_VALUES.ACHIEVEMENT_EASY,
  medium: XP_VALUES.ACHIEVEMENT_MEDIUM,
  hard: XP_VALUES.ACHIEVEMENT_HARD,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ newlyUnlocked: [] });

  const admin = createAdminClient();

  const [profileRes, predsRes, tournamentRes, friendsRes, groupsRes, exactPredsRes, totalMatchCount, streakStats] = await Promise.all([
    supabase.from('profiles').select('avatar_url').eq('id', user.id).single(),
    supabase.from('match_predictions').select('points_total, is_calculated').eq('user_id', user.id),
    supabase.from('tournament_predictions').select('champion_points, runner_up_points, third_place_points, group_predictions_points, champion, group_predictions').eq('user_id', user.id).maybeSingle(),
    supabase.from('friendships').select('id', { count: 'exact', head: true }).or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted'),
    supabase.from('groups').select('id').eq('created_by', user.id),
    supabase.from('match_predictions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('points_total', 3),
    supabase.from('matches').select('id', { count: 'exact', head: true }),
    getUserStreakStats(admin, user.id),
  ]);

  let maxGroupMembers = 0;
  if (groupsRes.data && groupsRes.data.length > 0) {
    const groupIds = groupsRes.data.map((g) => g.id);
    const { data: memberRows } = await supabase.from('group_members').select('group_id').in('group_id', groupIds);
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

  const totalXP = await getUserXP(admin, user.id);

  const stats: AchievementStats = {
    totalPredictions: preds.length,
    exactPredictions: exactPredsRes.count ?? 0,
    hasTournamentPrediction: !!(tp?.champion),
    groupPredictionsCount: tp?.group_predictions ? Object.keys(tp.group_predictions as Record<string, unknown>).length : 0,
    friendsCount: friendsRes.count ?? 0,
    groupsCreated: groupsRes.data?.length ?? 0,
    maxGroupMembers,
    totalPoints: calculated.reduce((sum, p) => sum + (p.points_total ?? 0), 0) + tournamentPoints,
    totalXP,
    totalMatches: totalMatchCount.count ?? 0,
    hasAvatar: isValidAvatarUrl(profileRes.data?.avatar_url),
    currentStreak: streakStats.currentStreak,
    maxStreak: streakStats.maxStreak,
    totalDaysActive: streakStats.totalDaysActive,
  };

  const achievements = getAchievements(stats);
  const completedAchievements = achievements.filter((a) => a.current >= a.target);

  // Award XP for all completed achievements (idempotent upsert)
  await Promise.all(
    completedAchievements.map((a) =>
      awardXP(admin, user.id, 'achievement', a.id, ACHIEVEMENT_XP[a.difficulty])
    )
  );

  return NextResponse.json({ completed: completedAchievements });
}
