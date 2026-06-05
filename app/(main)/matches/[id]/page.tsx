import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MatchPredictionClient } from '@/components/matches/match-prediction-client';
import { TEAM_NAME_ES } from '@/lib/teams';

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

  const match = {
    ...matchRes.data,
    home_team_name: TEAM_NAME_ES[matchRes.data.home_team_name ?? ''] ?? matchRes.data.home_team_name,
    away_team_name: TEAM_NAME_ES[matchRes.data.away_team_name ?? ''] ?? matchRes.data.away_team_name,
  };

  return (
    <MatchPredictionClient
      match={match}
      existingPrediction={predictionRes.data}
    />
  );
}
