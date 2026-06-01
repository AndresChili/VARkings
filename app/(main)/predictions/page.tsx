import { createClient } from '@/lib/supabase/server';
import { TournamentPredictionsClient } from '@/components/predictions/tournament-predictions-client';
import { STATIC_WC2026_TEAMS } from '@/lib/teams';

export default async function PredictionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [teamsRes, predictionRes] = await Promise.all([
    supabase.from('teams').select('*').order('name'),
    supabase
      .from('tournament_predictions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const teams = teamsRes.data && teamsRes.data.length > 0
    ? teamsRes.data
    : (STATIC_WC2026_TEAMS as unknown as typeof teamsRes.data);

  return (
    <TournamentPredictionsClient
      teams={teams ?? []}
      existingPrediction={predictionRes.data}
    />
  );
}
