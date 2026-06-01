import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { STATIC_WC2026_TEAMS } from '@/lib/teams';

type GroupRow = {
  group_id: string;
  member_count: number;
  groups: { id: string; name: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [predictionRes, teamsRes] = await Promise.all([
    supabase
      .from('tournament_predictions')
      .select('id, champion, runner_up, third_place, champion_points, runner_up_points, third_place_points, group_predictions_points')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('teams').select('*').order('name'),
  ]);

  // Separate query for groups to avoid nested select relation error
  const { data: memberRows } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const groupIds = memberRows?.map((m) => m.group_id) ?? [];
  const [{ data: groupsData }, { data: allMembersData }] = await Promise.all([
    groupIds.length > 0
      ? supabase.from('groups').select('id, name').in('id', groupIds)
      : Promise.resolve({ data: [] }),
    groupIds.length > 0
      ? supabase.from('group_members').select('group_id').in('group_id', groupIds)
      : Promise.resolve({ data: [] }),
  ]);

  const memberCounts = (allMembersData ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.group_id] = (acc[m.group_id] ?? 0) + 1;
    return acc;
  }, {});

  const groups: GroupRow[] = (memberRows ?? []).map((m) => ({
    group_id: m.group_id,
    member_count: memberCounts[m.group_id] ?? 0,
    groups: (groupsData ?? []).find((g) => g.id === m.group_id) ?? null,
  }));

  const teams = teamsRes.data && teamsRes.data.length > 0
    ? teamsRes.data
    : (STATIC_WC2026_TEAMS as unknown as typeof teamsRes.data);

  return (
    <DashboardClient
      groups={groups}
      tournamentPrediction={predictionRes.data}
      teams={teams ?? []}
    />
  );
}
