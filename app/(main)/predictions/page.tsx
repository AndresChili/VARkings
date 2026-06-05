import { createClient } from '@/lib/supabase/server';
import { getCachedTeams } from '@/lib/data-cache';
import { TournamentPredictionsClient } from '@/components/predictions/tournament-predictions-client';
import { STATIC_WC2026_TEAMS } from '@/lib/teams';

export default async function PredictionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [teamsData, predictionRes] = await Promise.all([
    getCachedTeams(),
    supabase
      .from('tournament_predictions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const teams = teamsData.length > 0
    ? teamsData
    : (STATIC_WC2026_TEAMS as unknown as typeof teamsData);

  return (
    <TournamentPredictionsClient
      teams={teams}
      existingPrediction={predictionRes.data}
    />
  );
}
