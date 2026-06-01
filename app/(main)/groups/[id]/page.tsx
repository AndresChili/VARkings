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

  const [leaderboardRes, matchesRes, membersCountRes, teamsRes] = await Promise.all([
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
    supabase.from('teams').select('*').order('name'),
  ]);

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

  const myPodio = championPicks[user.id] ?? null;

  const teams: Team[] = (teamsRes.data && teamsRes.data.length > 0
    ? teamsRes.data
    : (STATIC_WC2026_TEAMS as unknown as typeof teamsRes.data)) ?? [];

  return (
    <GroupDetailClient
      group={groupRes.data}
      leaderboard={leaderboardRes.data ?? []}
      upcomingMatches={(matchesRes.data ?? []) as Match[]}
      userId={user.id}
      memberCount={membersCountRes.count ?? 0}
      championPicks={championPicks}
      myPodio={myPodio}
      teams={teams}
    />
  );
}
