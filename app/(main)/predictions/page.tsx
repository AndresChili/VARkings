import { createClient } from '@/lib/supabase/server';
import { TournamentPredictionsClient } from '@/components/predictions/tournament-predictions-client';

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

  return (
    <TournamentPredictionsClient
      teams={teamsRes.data ?? []}
      existingPrediction={predictionRes.data}
    />
  );
}
