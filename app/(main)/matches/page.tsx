import { createClient } from '@/lib/supabase/server';
import { getCachedAllMatches } from '@/lib/data-cache';
import { MatchesClient } from '@/components/matches/matches-client';

type PredictionRow = {
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  points_total: number;
  is_calculated: boolean;
};

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [matches, predsRes] = await Promise.all([
    getCachedAllMatches(),
    supabase
      .from('match_predictions')
      .select('match_id, predicted_home_score, predicted_away_score, points_total, is_calculated')
      .eq('user_id', user.id),
  ]);

  const predictions = (predsRes.data ?? []) as PredictionRow[];
  const predictionMap = predictions.reduce((acc, p) => {
    acc[p.match_id] = p;
    return acc;
  }, {} as Record<string, PredictionRow>);

  return <MatchesClient matches={matches} predictionMap={predictionMap} />;
}
