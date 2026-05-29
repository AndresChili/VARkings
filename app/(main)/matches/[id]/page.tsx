import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MatchPredictionClient } from '@/components/matches/match-prediction-client';

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [matchRes, predictionRes] = await Promise.all([
    supabase.from('matches').select('*').eq('id', id).single(),
    supabase
      .from('match_predictions')
      .select('*')
      .eq('match_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!matchRes.data) notFound();

  return (
    <MatchPredictionClient
      match={matchRes.data}
      existingPrediction={predictionRes.data}
    />
  );
}
