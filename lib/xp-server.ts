import type { SupabaseClient } from '@supabase/supabase-js';
import { XP_VALUES } from './xp';

export async function getUserXP(
  adminClient: SupabaseClient,
  userId: string
): Promise<number> {
  const [eventsRes, predsRes] = await Promise.all([
    adminClient.from('xp_events').select('points').eq('user_id', userId),
    adminClient
      .from('match_predictions')
      .select('points_total')
      .eq('user_id', userId)
      .eq('is_calculated', true),
  ]);

  const eventsXP = (eventsRes.data ?? []).reduce(
    (sum: number, e: { points: number }) => sum + e.points,
    0
  );
  const matchXP = (predsRes.data ?? []).reduce(
    (sum: number, p: { points_total: number }) =>
      sum + (p.points_total ?? 0) * XP_VALUES.MATCH_MULTIPLIER,
    0
  );

  return eventsXP + matchXP;
}

export async function getBulkXP(
  adminClient: SupabaseClient,
  userIds: string[]
): Promise<Map<string, number>> {
  if (!userIds.length) return new Map();

  const [eventsRes, predsRes] = await Promise.all([
    adminClient.from('xp_events').select('user_id, points').in('user_id', userIds),
    adminClient
      .from('match_predictions')
      .select('user_id, points_total')
      .in('user_id', userIds)
      .eq('is_calculated', true),
  ]);

  const xpMap = new Map<string, number>(userIds.map((id) => [id, 0]));

  for (const e of eventsRes.data ?? []) {
    xpMap.set(e.user_id, (xpMap.get(e.user_id) ?? 0) + e.points);
  }
  for (const p of predsRes.data ?? []) {
    xpMap.set(
      p.user_id,
      (xpMap.get(p.user_id) ?? 0) + (p.points_total ?? 0) * XP_VALUES.MATCH_MULTIPLIER
    );
  }

  return xpMap;
}

export async function awardXP(
  adminClient: SupabaseClient,
  userId: string,
  sourceType: string,
  sourceId: string,
  points: number
): Promise<void> {
  await adminClient
    .from('xp_events')
    .upsert(
      { user_id: userId, source_type: sourceType, source_id: sourceId, points },
      { onConflict: 'user_id,source_type,source_id', ignoreDuplicates: true }
    );
}

interface BonusInputs {
  totalPredictions: number;
  groupStagePredictions: number;
  hasAvatar: boolean;
  tournamentCalc: {
    is_calculated: boolean;
    champion_points: number | null;
    runner_up_points: number | null;
    third_place_points: number | null;
  } | null;
}

export async function computeAndAwardBonuses(
  adminClient: SupabaseClient,
  userId: string,
  data: BonusInputs
): Promise<void> {
  const awards: Array<{ type: string; id: string; pts: number }> = [];

  if (data.totalPredictions >= 1)
    awards.push({ type: 'first_prediction', id: 'once', pts: XP_VALUES.FIRST_PREDICTION });

  if (data.groupStagePredictions >= 48)
    awards.push({ type: 'all_group_stage', id: 'once', pts: XP_VALUES.ALL_GROUP_STAGE });

  if (data.totalPredictions >= 64)
    awards.push({ type: 'all_tournament', id: 'once', pts: XP_VALUES.ALL_TOURNAMENT });

  if (data.hasAvatar)
    awards.push({ type: 'avatar', id: 'once', pts: XP_VALUES.PROFILE_AVATAR });

  const tp = data.tournamentCalc;
  if (tp?.is_calculated) {
    const champ = (tp.champion_points ?? 0) > 0;
    const runner = (tp.runner_up_points ?? 0) > 0;
    const third = (tp.third_place_points ?? 0) > 0;

    if (champ)
      awards.push({ type: 'champion_correct', id: 'once', pts: XP_VALUES.CHAMPION_CORRECT });
    if (runner)
      awards.push({ type: 'runner_up_correct', id: 'once', pts: XP_VALUES.RUNNER_UP_CORRECT });
    if (third)
      awards.push({ type: 'third_place_correct', id: 'once', pts: XP_VALUES.THIRD_PLACE_CORRECT });
    if (champ && runner && third)
      awards.push({ type: 'full_podium_bonus', id: 'once', pts: XP_VALUES.FULL_PODIUM_BONUS });
  }

  await Promise.all(
    awards.map((a) => awardXP(adminClient, userId, a.type, a.id, a.pts))
  );
}

export async function awardFriendXP(
  adminClient: SupabaseClient,
  userId: string,
  friendUserId: string
): Promise<void> {
  const { count } = await adminClient
    .from('xp_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('source_type', ['friend_first', 'friend_add']);

  const existing = count ?? 0;

  if (existing === 0) {
    await awardXP(adminClient, userId, 'friend_first', 'once', XP_VALUES.FRIEND_FIRST);
  } else if (existing < 10) {
    await awardXP(adminClient, userId, 'friend_add', friendUserId, XP_VALUES.FRIEND_ADD);
  }
}

export async function awardGroupJoinXP(
  adminClient: SupabaseClient,
  userId: string,
  groupId: string
): Promise<void> {
  const { count } = await adminClient
    .from('xp_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source_type', 'group_join');

  if ((count ?? 0) < 3) {
    await awardXP(adminClient, userId, 'group_join', groupId, XP_VALUES.GROUP_JOIN);
  }
}

export async function checkGroupMilestonesXP(
  adminClient: SupabaseClient,
  groupId: string,
  creatorId: string
): Promise<void> {
  const { count } = await adminClient
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);

  if ((count ?? 0) >= 5) {
    await awardXP(adminClient, creatorId, 'group_milestone_5', groupId, XP_VALUES.GROUP_MILESTONE_5);
  }
}
