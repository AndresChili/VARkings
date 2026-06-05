import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCachedTeams, getCachedGroupStageMatches, getCachedAllMatches } from '@/lib/data-cache';
import { GroupDetailClient } from '@/components/groups/group-detail-client';
import { STATIC_WC2026_TEAMS, TEAM_NAME_ES } from '@/lib/teams';
import type { Match, Team, MatchPrediction } from '@/types';

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [groupRes, memberRes] = await Promise.all([
    supabase.from('groups').select('*').eq('id', id).single(),
    supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!groupRes.data) notFound();
  if (!memberRes.data) redirect('/dashboard');

  const isCreator = groupRes.data.created_by === user.id;

  const [leaderboardRes, allMatches, membersCountRes, requestsRes, teamsData, groupStageMatchesData] = await Promise.all([
    supabase
      .from('group_leaderboard')
      .select('*')
      .eq('group_id', id)
      .order('total_points', { ascending: false }),
    getCachedAllMatches(),
    supabase
      .from('group_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('group_id', id),
    isCreator
      ? supabase.from('join_requests').select('id, user_id, created_at').eq('group_id', id).eq('status', 'pending').order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; user_id: string; created_at: string }> }),
    getCachedTeams(),
    getCachedGroupStageMatches(),
  ]);

  // Build teams with group_name from matches (same logic as dashboard)
  const teamMap = new Map<string, { name: string; logo: string | null; group: string }>();
  groupStageMatchesData.forEach((m) => {
    if (m.home_team_name && m.group_name) teamMap.set(m.home_team_name, { name: TEAM_NAME_ES[m.home_team_name] ?? m.home_team_name, logo: m.home_team_logo, group: m.group_name });
    if (m.away_team_name && m.group_name) teamMap.set(m.away_team_name, { name: TEAM_NAME_ES[m.away_team_name] ?? m.away_team_name, logo: m.away_team_logo, group: m.group_name });
  });
  const teamsFromMatches = Array.from(teamMap.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((t) => ({ id: t.name, name: t.name, short_name: null as string | null, logo_url: t.logo, group_name: t.group, api_id: null as number | null, created_at: '' }));

  const teams: Team[] = teamsFromMatches.length > 0
    ? teamsFromMatches
    : teamsData.length > 0
    ? teamsData.map((t) => ({ ...t, name: TEAM_NAME_ES[t.name] ?? t.name }))
    : (STATIC_WC2026_TEAMS as unknown as Team[]);

  const memberIds = (leaderboardRes.data ?? []).map((e) => e.user_id);
  const pendingUserIds = (requestsRes.data ?? []).map((r) => r.user_id);

  const [{ data: groupPreds }, { data: pendingProfiles }, { data: memberGroupPredsRaw }, { data: memberMatchPredsRaw }] = await Promise.all([
    memberIds.length > 0
      ? supabase
          .from('group_tournament_predictions')
          .select('user_id, champion, runner_up, third_place')
          .eq('group_id', id)
          .in('user_id', memberIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; champion: string | null; runner_up: string | null; third_place: string | null }> }),
    pendingUserIds.length > 0
      ? supabase.from('profiles').select('id, username').in('id', pendingUserIds)
      : Promise.resolve({ data: [] as Array<{ id: string; username: string }> }),
    memberIds.length > 0
      ? supabase
          .from('tournament_predictions')
          .select('user_id, group_predictions')
          .in('user_id', memberIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; group_predictions: Record<string, string[]> | null }> }),
    memberIds.length > 0
      ? supabase
          .from('match_predictions')
          .select('user_id, match_id, predicted_home_score, predicted_away_score, points_total, is_calculated')
          .in('user_id', memberIds)
      : Promise.resolve({ data: [] as Array<Pick<MatchPrediction, 'user_id' | 'match_id' | 'predicted_home_score' | 'predicted_away_score' | 'points_total' | 'is_calculated'>> }),
  ]);

  const championPicks: Record<string, { champion: string | null; runner_up: string | null; third_place: string | null }> = {};
  for (const p of groupPreds ?? []) {
    championPicks[p.user_id] = { champion: p.champion, runner_up: p.runner_up, third_place: p.third_place };
  }
  const memberGroupPicks: Record<string, Record<string, string[]>> = {};
  for (const p of memberGroupPredsRaw ?? []) {
    if (p.group_predictions) memberGroupPicks[p.user_id] = p.group_predictions as Record<string, string[]>;
  }
  const predsByMatch: Record<string, Array<Pick<MatchPrediction, 'user_id' | 'match_id' | 'predicted_home_score' | 'predicted_away_score' | 'points_total' | 'is_calculated'>>> = {};
  for (const pred of memberMatchPredsRaw ?? []) {
    if (!predsByMatch[pred.match_id]) predsByMatch[pred.match_id] = [];
    predsByMatch[pred.match_id].push(pred);
  }
  const matchesWithPredictions = (allMatches as Match[]).map((m) => ({
    ...m,
    memberPredictions: predsByMatch[m.id] ?? [],
  }));

  const profileMap = Object.fromEntries((pendingProfiles ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));
  const pendingRequests = (requestsRes.data ?? []).map((r) => ({
    user_id: r.user_id,
    username: profileMap[r.user_id] ?? 'Usuario',
    created_at: r.created_at,
  }));

  return (
    <GroupDetailClient
      group={groupRes.data}
      leaderboard={leaderboardRes.data ?? []}
      matchesWithPredictions={matchesWithPredictions}
      userId={user.id}
      memberCount={membersCountRes.count ?? 0}
      championPicks={championPicks}
      myPodio={championPicks[user.id] ?? null}
      pendingRequests={pendingRequests}
      teams={teams}
      memberGroupPicks={memberGroupPicks}
    />
  );
}
