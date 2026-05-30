import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

type GroupRow = {
  group_id: string;
  groups: { id: string; name: string; description: string | null } | null;
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
  const { data: groupsData } = groupIds.length > 0
    ? await supabase.from('groups').select('id, name, description').in('id', groupIds)
    : { data: [] };

  const groups: GroupRow[] = (memberRows ?? []).map((m) => ({
    group_id: m.group_id,
    groups: (groupsData ?? []).find((g) => g.id === m.group_id) ?? null,
  }));

  return (
    <DashboardClient
      groups={groups}
      tournamentPrediction={predictionRes.data}
      teams={teamsRes.data ?? []}
    />
  );
}
