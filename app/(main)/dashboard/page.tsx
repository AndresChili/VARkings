import { createClient } from '@/lib/supabase/server';
import { getCachedTeams, getCachedGroupStageMatches } from '@/lib/data-cache';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { STATIC_WC2026_TEAMS, TEAM_NAME_ES } from '@/lib/teams';

type GroupRow = {
  group_id: string;
  member_count: number;
  is_admin: boolean;
  groups: { id: string; name: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [predictionRes, teamsData, groupStageMatchesData, memberRowsRes, invitesRes] = await Promise.all([
    supabase
      .from('tournament_predictions')
      .select('id, champion, runner_up, third_place, champion_points, runner_up_points, third_place_points, group_predictions_points')
      .eq('user_id', user.id)
      .maybeSingle(),
    getCachedTeams(),
    getCachedGroupStageMatches(),
    supabase.from('group_members').select('group_id').eq('user_id', user.id),
    supabase
      .from('group_invites')
      .select('id, group_id, inviter_id, created_at, groups(name), profiles!group_invites_inviter_id_fkey(username)')
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ]);

  const memberRows = memberRowsRes;

  const groupIds = memberRows.data?.map((m) => m.group_id) ?? [];
  const [{ data: groupsData }, { data: allMembersData }] = await Promise.all([
    groupIds.length > 0
      ? supabase.from('groups').select('id, name, created_by').in('id', groupIds)
      : Promise.resolve({ data: [] }),
    groupIds.length > 0
      ? supabase.from('group_members').select('group_id').in('group_id', groupIds)
      : Promise.resolve({ data: [] }),
  ]);

  const memberCounts = (allMembersData ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.group_id] = (acc[m.group_id] ?? 0) + 1;
    return acc;
  }, {});

  const groups: GroupRow[] = (memberRows.data ?? []).map((m) => {
    const groupData = (groupsData ?? []).find((g) => g.id === m.group_id) ?? null;
    return {
      group_id: m.group_id,
      member_count: memberCounts[m.group_id] ?? 0,
      is_admin: groupData?.created_by === user.id,
      groups: groupData ? { id: groupData.id, name: groupData.name } : null,
    };
  });

  // Build team list with group info derived from matches (source of truth for groups)
  const teamMap = new Map<string, { name: string; logo: string | null; group: string }>();
  groupStageMatchesData.forEach((m) => {
    if (m.home_team_name && m.group_name) teamMap.set(m.home_team_name, { name: TEAM_NAME_ES[m.home_team_name] ?? m.home_team_name, logo: m.home_team_logo, group: m.group_name });
    if (m.away_team_name && m.group_name) teamMap.set(m.away_team_name, { name: TEAM_NAME_ES[m.away_team_name] ?? m.away_team_name, logo: m.away_team_logo, group: m.group_name });
  });

  const teamsFromMatches = Array.from(teamMap.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((t) => ({
      id: t.name,
      name: t.name,
      short_name: null as string | null,
      logo_url: t.logo,
      group_name: t.group,
      api_id: null as number | null,
      created_at: '',
    }));

  const teams = teamsFromMatches.length > 0
    ? teamsFromMatches
    : teamsData.length > 0
    ? teamsData.map((t) => ({ ...t, name: TEAM_NAME_ES[t.name] ?? t.name }))
    : (STATIC_WC2026_TEAMS as unknown as typeof teamsData);

  const groupInvites = (invitesRes.data ?? []).map((inv: Record<string, unknown>) => ({
    id: inv.id as string,
    group_id: inv.group_id as string,
    group_name: (inv.groups as { name: string } | null)?.name ?? 'Grupo',
    inviter_username: (inv.profiles as { username: string } | null)?.username ?? 'Alguien',
    created_at: inv.created_at as string,
  }));

  return (
    <DashboardClient
      userId={user.id}
      groups={groups}
      tournamentPrediction={predictionRes.data}
      teams={teams ?? []}
      groupInvites={groupInvites}
    />
  );
}
