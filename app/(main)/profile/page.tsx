import { createClient } from '@/lib/supabase/server';
import { ProfileClient } from '@/components/profile/profile-client';

type PredRow = {
  points_total: number;
  points_winner: number;
  is_calculated: boolean;
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, predsRes, tournamentRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('match_predictions')
      .select('points_total, points_winner, is_calculated')
      .eq('user_id', user.id),
    supabase
      .from('tournament_predictions')
      .select('champion_points, runner_up_points, third_place_points, group_predictions_points')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const preds = (predsRes.data ?? []) as PredRow[];
  const calculated = preds.filter((p) => p.is_calculated);
  const tp = tournamentRes.data;
  const tournamentPoints = tp
    ? (tp.champion_points ?? 0) + (tp.runner_up_points ?? 0) + (tp.third_place_points ?? 0) + (tp.group_predictions_points ?? 0)
    : 0;

  const stats = {
    totalPredictions: preds.length,
    calculatedPredictions: calculated.length,
    matchPoints: calculated.reduce((sum, p) => sum + (p.points_total ?? 0), 0) + tournamentPoints,
    correctWinners: calculated.filter((p) => (p.points_winner ?? 0) > 0).length,
  };

  return <ProfileClient profile={profileRes.data} stats={stats} email={user.email ?? ''} />;
}
