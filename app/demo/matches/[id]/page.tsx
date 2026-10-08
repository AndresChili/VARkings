import { notFound } from 'next/navigation';
import { MatchPredictionClient } from '@/components/matches/match-prediction-client';
import { DEMO_MATCHES, getDemoExistingPrediction } from '@/lib/demo/demo-data';

export default async function DemoMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = DEMO_MATCHES.find((m) => m.id === id);
  if (!match) notFound();

  return (
    <MatchPredictionClient
      basePath="/demo"
      match={match}
      existingPrediction={getDemoExistingPrediction(id)}
    />
  );
}
