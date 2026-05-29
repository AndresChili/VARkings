import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import type { Match } from '@/types';

type GroupRow = {
  group_id: string;
  groups: { id: string; name: string; description: string | null } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, matchesRes, predictionRes, matchPointsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('matches')
      .select('*')
      .gte('match_date', new Date().toISOString())
      .order('match_date', { ascending: true })
      .limit(5),
    supabase
      .from('tournament_predictions')
      .select('id, champion, runner_up, third_place, champion_points, runner_up_points, third_place_points, group_predictions_points')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('match_predictions')
      .select('points_total')
      .eq('user_id', user.id)
      .eq('is_calculated', true),
  ]);

  // Separate query for groups to avoid nested select relation error
  const { data: memberRows } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .limit(5);

  const groupIds = memberRows?.map((m) => m.group_id) ?? [];
  const { data: groupsData } = groupIds.length > 0
    ? await supabase.from('groups').select('id, name, description').in('id', groupIds)
    : { data: [] };

  const groups: GroupRow[] = (memberRows ?? []).map((m) => ({
    group_id: m.group_id,
    groups: (groupsData ?? []).find((g) => g.id === m.group_id) ?? null,
  }));

  const matchPoints = (matchPointsRes.data ?? []).reduce(
    (sum, p) => sum + (p.points_total ?? 0),
    0
  );

  const tp = predictionRes.data;
  const tournamentPoints = tp
    ? (tp.champion_points ?? 0) + (tp.runner_up_points ?? 0) + (tp.third_place_points ?? 0) + (tp.group_predictions_points ?? 0)
    : 0;

  return (
    <DashboardClient
      profile={profileRes.data}
      groups={groups}
      upcomingMatches={(matchesRes.data ?? []) as Match[]}
      tournamentPrediction={predictionRes.data}
      totalPoints={matchPoints + tournamentPoints}
    />
  );
}
