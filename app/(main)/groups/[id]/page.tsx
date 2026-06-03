import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GroupDetailClient } from '@/components/groups/group-detail-client';
import { STATIC_WC2026_TEAMS } from '@/lib/teams';
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
  if (!memberRes.data) redirect('/groups');

  const isCreator = groupRes.data.created_by === user.id;

  const [leaderboardRes, matchesRes, membersCountRes, requestsRes, teamsRes, globalPredRes] = await Promise.all([
    supabase
      .from('group_leaderboard')
      .select('*')
      .eq('group_id', id)
      .order('total_points', { ascending: false }),
    supabase
      .from('matches')
      .select('*')
      .gte('match_date', new Date().toISOString())
      .order('match_date', { ascending: true })
      .limit(10),
    supabase
      .from('group_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('group_id', id),
    isCreator
      ? supabase.from('join_requests').select('id, user_id, created_at').eq('group_id', id).eq('status', 'pending').order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; user_id: string; created_at: string }> }),
    supabase.from('teams').select('*').order('name'),
    supabase.from('tournament_predictions').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);

  const teams: Team[] = (teamsRes.data && teamsRes.data.length > 0
    ? teamsRes.data
    : (STATIC_WC2026_TEAMS as unknown as Team[]));

  const memberIds = (leaderboardRes.data ?? []).map((e) => e.user_id);
  const { data: groupPreds } = memberIds.length > 0
    ? await supabase
        .from('group_tournament_predictions')
        .select('user_id, champion, runner_up, third_place')
        .eq('group_id', id)
        .in('user_id', memberIds)
    : { data: [] };

  const championPicks: Record<string, { champion: string | null; runner_up: string | null; third_place: string | null }> = {};
  for (const p of groupPreds ?? []) {
    championPicks[p.user_id] = { champion: p.champion, runner_up: p.runner_up, third_place: p.third_place };
  }

  // Fetch usernames for pending requests
  const pendingUserIds = (requestsRes.data ?? []).map((r) => r.user_id);
  const { data: pendingProfiles } = pendingUserIds.length > 0
    ? await supabase.from('profiles').select('id, username').in('id', pendingUserIds)
    : { data: [] };
  const profileMap = Object.fromEntries((pendingProfiles ?? []).map((p) => [p.id, p.username]));
  const pendingRequests = (requestsRes.data ?? []).map((r) => ({
    user_id: r.user_id,
    username: profileMap[r.user_id] ?? 'Usuario',
    created_at: r.created_at,
  }));

  return (
    <GroupDetailClient
      group={groupRes.data}
      leaderboard={leaderboardRes.data ?? []}
      upcomingMatches={(matchesRes.data ?? []) as Match[]}
      userId={user.id}
      memberCount={membersCountRes.count ?? 0}
      championPicks={championPicks}
      myPodio={championPicks[user.id] ?? null}
      pendingRequests={pendingRequests}
      teams={teams}
      hasGlobalPrediction={!!globalPredRes.data}
    />
  );
}
