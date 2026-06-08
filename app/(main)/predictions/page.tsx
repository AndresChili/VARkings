import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getCachedTeams, getCachedGroupStageMatches } from '@/lib/data-cache';
import { TournamentPredictionsClient } from '@/components/predictions/tournament-predictions-client';
import { STATIC_WC2026_TEAMS, TEAM_NAME_ES } from '@/lib/teams';

export default async function PredictionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [teamsData, predictionRes, groupStageMatches, r16Matches, finalMatch, thirdMatch] = await Promise.all([
    getCachedTeams(),
    supabase.from('tournament_predictions').select('*').eq('user_id', user.id).maybeSingle(),
    getCachedGroupStageMatches(),
    admin.from('matches').select('home_team_name, away_team_name').eq('stage', 'Round of 16').not('home_team_name', 'is', null).not('away_team_name', 'is', null),
    admin.from('matches').select('home_team_name, away_team_name, home_score, away_score').eq('stage', 'Final').in('status', ['FT', 'AET', 'PEN']).maybeSingle(),
    admin.from('matches').select('home_team_name, away_team_name, home_score, away_score').eq('stage', 'Third Place').in('status', ['FT', 'AET', 'PEN']).maybeSingle(),
  ]);

  const rawTeams = teamsData.length > 0
    ? teamsData
    : (STATIC_WC2026_TEAMS as unknown as typeof teamsData);

  const teams = rawTeams.map((t) => ({ ...t, name: TEAM_NAME_ES[t.name] ?? t.name }));

  // Derive group qualifiers from Round of 16 fixtures
  const teamGroupMap = new Map<string, string>();
  groupStageMatches.forEach((m) => {
    if (m.home_team_name && m.group_name) teamGroupMap.set(m.home_team_name, m.group_name);
    if (m.away_team_name && m.group_name) teamGroupMap.set(m.away_team_name, m.group_name);
  });

  const groupQualifiers: Record<string, string[]> = {};
  for (const m of r16Matches.data ?? []) {
    for (const teamName of [m.home_team_name, m.away_team_name]) {
      if (!teamName) continue;
      const group = teamGroupMap.get(teamName);
      if (!group) continue;
      const esName = TEAM_NAME_ES[teamName] ?? teamName;
      if (!groupQualifiers[group]) groupQualifiers[group] = [];
      if (!groupQualifiers[group].includes(esName)) groupQualifiers[group].push(esName);
    }
  }

  // Derive actual podio from Final + Third Place match results
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
