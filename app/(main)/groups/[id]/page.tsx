import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCachedTeams, getCachedGroupStageMatches, getCachedUpcomingMatches } from '@/lib/data-cache';
import { GroupDetailClient } from '@/components/groups/group-detail-client';
import { STATIC_WC2026_TEAMS, TEAM_NAME_ES } from '@/lib/teams';
import type { Match, Team } from '@/types';

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

  const [leaderboardRes, upcomingMatches, membersCountRes, requestsRes, teamsData, groupStageMatchesData] = await Promise.all([
    supabase
      .from('group_leaderboard')
      .select('*')
      .eq('group_id', id)
      .order('total_points', { ascending: false }),
    getCachedUpcomingMatches(),
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
    ? teamsData
    : (STATIC_WC2026_TEAMS as unknown as Team[]);

  const memberIds = (leaderboardRes.data ?? []).map((e) => e.user_id);
  const pendingUserIds = (requestsRes.data ?? []).map((r) => r.user_id);

  const [{ data: groupPreds }, { data: pendingProfiles }] = await Promise.all([
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
  ]);

  const championPicks: Record<string, { champion: string | null; runner_up: string | null; third_place: string | null }> = {};
  for (const p of groupPreds ?? []) {
    championPicks[p.user_id] = { champion: p.champion, runner_up: p.runner_up, third_place: p.third_place };
  }
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
      upcomingMatches={upcomingMatches as Match[]}
      userId={user.id}
      memberCount={membersCountRes.count ?? 0}
      championPicks={championPicks}
      myPodio={championPicks[user.id] ?? null}
      pendingRequests={pendingRequests}
      teams={teams}
    />
  );
}
