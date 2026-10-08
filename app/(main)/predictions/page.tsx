import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getCachedTeams } from '@/lib/data-cache';
import { getGroupQualifiers } from '@/lib/group-qualifiers';
import { TournamentPredictionsClient } from '@/components/predictions/tournament-predictions-client';
import { STATIC_WC2026_TEAMS, TEAM_NAME_ES } from '@/lib/teams';

export default async function PredictionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [teamsData, predictionRes, groupQualifiers, finalMatch, thirdMatch] = await Promise.all([
    getCachedTeams(),
    supabase.from('tournament_predictions').select('*').eq('user_id', user.id).maybeSingle(),
    getGroupQualifiers(),
    admin.from('matches').select('home_team_name, away_team_name, home_score, away_score').eq('stage', 'Final').in('status', ['FT', 'AET', 'PEN']).maybeSingle(),
    admin.from('matches').select('home_team_name, away_team_name, home_score, away_score').eq('stage', 'Third Place').in('status', ['FT', 'AET', 'PEN']).maybeSingle(),
  ]);

  const rawTeams = teamsData.length > 0
    ? teamsData
    : (STATIC_WC2026_TEAMS as unknown as typeof teamsData);

  const teams = rawTeams.map((t) => ({ ...t, name: TEAM_NAME_ES[t.name] ?? t.name }));

  // Deriva el podio real a partir de los resultados de la Final + el Tercer puesto
  let actualPodio: { champion: string | null; runnerUp: string | null; thirdPlace: string | null } | null = null;
  if (finalMatch.data && thirdMatch.data) {
    const f = finalMatch.data;
    const t = thirdMatch.data;
    const fHome = f.home_score ?? 0;
    const fAway = f.away_score ?? 0;
    const tHome = t.home_score ?? 0;
    const tAway = t.away_score ?? 0;
    actualPodio = {
      champion: TEAM_NAME_ES[fHome >= fAway ? (f.home_team_name ?? '') : (f.away_team_name ?? '')] ?? (fHome >= fAway ? f.home_team_name : f.away_team_name),
      runnerUp: TEAM_NAME_ES[fHome >= fAway ? (f.away_team_name ?? '') : (f.home_team_name ?? '')] ?? (fHome >= fAway ? f.away_team_name : f.home_team_name),
      thirdPlace: TEAM_NAME_ES[tHome >= tAway ? (t.home_team_name ?? '') : (t.away_team_name ?? '')] ?? (tHome >= tAway ? t.home_team_name : t.away_team_name),
    };
  }

  return (
    <TournamentPredictionsClient
      teams={teams}
      existingPrediction={predictionRes.data}
      groupQualifiers={groupQualifiers}
      actualPodio={actualPodio}
    />
  );
}
