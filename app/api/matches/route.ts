import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getLiveWCMatches, getRecentlyFinishedWCMatches, getWCMatches, mapFDStatus, mapFDStage, mapFDGroup } from '@/lib/football-data';
import { revalidateTag } from 'next/cache';
import { TEAM_NAME_ES } from '@/lib/teams';
import { calculateMatchPoints, calculateGroupPoints, calculateTournamentPoints } from '@/lib/scoring';

const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET', 'P', 'BT'];
const DEBOUNCE_MS = 75_000;

export async function GET() {
  const supabase = createAdminClient();

  // Find any match that is live, started but still NS, OR recently finished (to catch uncalculated predictions)
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: candidateMatches } = await supabase
    .from('matches')
    .select('id, status, updated_at, match_date')
    .or(
      `status.in.(${LIVE_STATUSES.join(',')}),` +
      `and(status.eq.NS,match_date.lte.${nowIso},match_date.gte.${twelveHoursAgo}),` +
      `and(status.in.(FT,AET,PEN),match_date.gte.${twelveHoursAgo})`
    )
    .limit(5);

  const needsRefresh = (candidateMatches ?? []).some((m) => {
    const msSinceUpdate = Date.now() - new Date(m.updated_at).getTime();
    return msSinceUpdate > DEBOUNCE_MS;
  });

  if (needsRefresh) {
    try {
      // If any knockout match is missing team names, sync all fixtures first
      const { data: unnamedKnockout } = await supabase
        .from('matches')
        .select('id')
        .neq('stage', 'Group Stage')
        .or('home_team_name.is.null,away_team_name.is.null')
        .limit(1);

      if (unnamedKnockout && unnamedKnockout.length > 0) {
        const allFixtures = await getWCMatches();
        const knockoutUpserts = allFixtures
          .map((f) => ({
            api_id: f.id,
            home_team_name: f.homeTeam?.name || null,
            away_team_name: f.awayTeam?.name || null,
            home_team_logo: f.homeTeam?.crest ?? null,
            away_team_logo: f.awayTeam?.crest ?? null,
            match_date: f.utcDate,
            stage: mapFDStage(f.stage),
            group_name: mapFDGroup(f.group),
            home_score: f.score.fullTime.home,
            away_score: f.score.fullTime.away,
            status: mapFDStatus(f.status, f.score.duration),
          }));
        if (knockoutUpserts.length > 0) {
          await supabase.from('matches').upsert(knockoutUpserts, { onConflict: 'api_id' });
          await supabase.from('matches').delete().is('api_id', null).neq('stage', 'Group Stage');
          revalidateTag('matches');
        }
      }

      const [live, finished] = await Promise.all([
        getLiveWCMatches(),
        getRecentlyFinishedWCMatches(),
      ]);

      const now = new Date().toISOString();

      for (const fixture of live) {
        const homeScore = fixture.score.fullTime.home;
        const awayScore = fixture.score.fullTime.away;
        await supabase
          .from('matches')
          .update({
            status: mapFDStatus(fixture.status),
            ...(homeScore !== null && awayScore !== null
              ? { home_score: homeScore, away_score: awayScore }
              : {}),
            updated_at: now,
          })
          .eq('api_id', fixture.id);
      }

      for (const fixture of finished) {
        const homeScore = fixture.score.fullTime.home;
        const awayScore = fixture.score.fullTime.away;
        if (homeScore === null || awayScore === null) continue;

        const { data: match } = await supabase
          .from('matches')
          .select('id, status')
          .eq('api_id', fixture.id)
          .maybeSingle();

        if (!match) continue;

        const alreadyFinished = ['FT', 'AET', 'PEN'].includes(match.status);
        const newStatus = mapFDStatus(fixture.status, fixture.score.duration);
        const winnerName = fixture.score.winner === 'HOME_TEAM'
          ? (fixture.homeTeam?.name ?? null)
          : fixture.score.winner === 'AWAY_TEAM'
          ? (fixture.awayTeam?.name ?? null)
          : null;

        if (!alreadyFinished) {
          await supabase
            .from('matches')
            .update({ status: newStatus, home_score: homeScore, away_score: awayScore, winner_team_name: winnerName, updated_at: now })
            .eq('id', match.id);
        } else {
          await supabase
            .from('matches')
            .update({ ...(winnerName ? { winner_team_name: winnerName } : {}), updated_at: now })
            .eq('id', match.id);
        }

        // Calculate points for uncalculated predictions
        const { data: predictions } = await supabase
          .from('match_predictions')
          .select('id, user_id, predicted_home_score, predicted_away_score')
          .eq('match_id', match.id)
          .eq('is_calculated', false);

        for (const pred of predictions ?? []) {
          const result = calculateMatchPoints(
            pred.predicted_home_score,
            pred.predicted_away_score,
            homeScore,
            awayScore,
          );

          await supabase
            .from('match_predictions')
            .update({
              points_winner: result.points_winner,
              points_home_score: result.points_home_score,
              points_away_score: result.points_away_score,
              points_total: result.points_total,
              is_calculated: true,
            })
            .eq('id', pred.id);

          if (result.points_total > 0) {
            await supabase.from('points_log').insert({
              user_id: pred.user_id,
              match_id: match.id,
              points: result.points_total,
              reason: 'match_prediction',
              description: `${fixture.homeTeam?.name ?? '?'} ${homeScore}-${awayScore} ${fixture.awayTeam?.name ?? '?'}`,
            });
          }
        }
      }

      revalidateTag('matches');
    } catch (err) {
      console.error('[matches/live] football-data error:', err);
    }
  }

  // Auto-calculate group prediction points when Round of 16 fixtures are known
  const { data: r16 } = await supabase
    .from('matches')
    .select('home_team_name, away_team_name')
    .eq('stage', 'Round of 16')
    .not('home_team_name', 'is', null)
    .not('away_team_name', 'is', null);

  if (r16 && r16.length > 0) {
    const { data: groupStageRows } = await supabase
      .from('matches')
      .select('home_team_name, away_team_name, group_name')
      .eq('stage', 'Group Stage')
      .not('group_name', 'is', null);

    const teamGroupMap = new Map<string, string>();
    for (const m of groupStageRows ?? []) {
      if (m.home_team_name && m.group_name) teamGroupMap.set(m.home_team_name, m.group_name);
      if (m.away_team_name && m.group_name) teamGroupMap.set(m.away_team_name, m.group_name);
    }

    const groupQualifiers: Record<string, string[]> = {};
    for (const m of r16) {
      for (const teamName of [m.home_team_name, m.away_team_name]) {
        if (!teamName) continue;
        const group = teamGroupMap.get(teamName);
        if (!group) continue;
        const esName = TEAM_NAME_ES[teamName] ?? teamName;
        if (!groupQualifiers[group]) groupQualifiers[group] = [];
        if (!groupQualifiers[group].includes(esName)) groupQualifiers[group].push(esName);
      }
    }

    if (Object.keys(groupQualifiers).length > 0) {
      const { data: tournPreds } = await supabase
        .from('tournament_predictions')
        .select('id, group_predictions, group_predictions_points');

      for (const pred of tournPreds ?? []) {
        const picks = pred.group_predictions as Record<string, string[]> | null;
        if (!picks) continue;
        let total = 0;
        for (const [group, pickedTeams] of Object.entries(picks)) {
          const qualifiers = groupQualifiers[group];
          if (!qualifiers || pickedTeams.length < 2) continue;
          total += calculateGroupPoints(pickedTeams as [string, string], qualifiers as [string, string]);
        }
        if (total !== pred.group_predictions_points) {
          await supabase
            .from('tournament_predictions')
            .update({ group_predictions_points: total })
            .eq('id', pred.id);
        }
      }
    }
  }

  // Auto-calculate podio points when Final and 3rd place match are finished
  const { data: finalMatch } = await supabase
    .from('matches')
    .select('home_team_name, away_team_name, home_score, away_score, winner_team_name')
    .eq('stage', 'Final')
    .in('status', ['FT', 'AET', 'PEN'])
    .maybeSingle();

  const { data: thirdMatch } = await supabase
    .from('matches')
    .select('home_team_name, away_team_name, home_score, away_score, winner_team_name')
    .eq('stage', 'Third Place')
    .in('status', ['FT', 'AET', 'PEN'])
    .maybeSingle();

  if (finalMatch && thirdMatch) {
    const fWinner = finalMatch.winner_team_name
      ?? (((finalMatch.home_score ?? 0) >= (finalMatch.away_score ?? 0)) ? finalMatch.home_team_name : finalMatch.away_team_name);
    const fLoser = finalMatch.winner_team_name
      ? (finalMatch.winner_team_name === finalMatch.home_team_name ? finalMatch.away_team_name : finalMatch.home_team_name)
      : (((finalMatch.home_score ?? 0) >= (finalMatch.away_score ?? 0)) ? finalMatch.away_team_name : finalMatch.home_team_name);

    const actualChampion = TEAM_NAME_ES[fWinner ?? ''] ?? fWinner;
    const actualRunnerUp = TEAM_NAME_ES[fLoser ?? ''] ?? fLoser;

    const tWinner = thirdMatch.winner_team_name
      ?? (((thirdMatch.home_score ?? 0) >= (thirdMatch.away_score ?? 0)) ? thirdMatch.home_team_name : thirdMatch.away_team_name);
    const actualThird = TEAM_NAME_ES[tWinner ?? ''] ?? tWinner;

    const { data: podPreds } = await supabase
      .from('tournament_predictions')
      .select('id, champion, runner_up, third_place, champion_points, runner_up_points, third_place_points, is_calculated');

    for (const pred of podPreds ?? []) {
      if (pred.is_calculated) continue;
      const result = calculateTournamentPoints({
        predictedChampion: pred.champion,
        predictedRunnerUp: pred.runner_up,
        predictedThird: pred.third_place,
        actualChampion: actualChampion ?? null,
        actualRunnerUp: actualRunnerUp ?? null,
        actualThird: actualThird ?? null,
      });
      await supabase
        .from('tournament_predictions')
        .update({
          champion_points: result.champion,
          runner_up_points: result.runner_up,
          third_place_points: result.third_place,
          is_calculated: true,
        })
        .eq('id', pred.id);
    }
  }

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  const translated = (matches ?? []).map((m) => ({
    ...m,
    home_team_name: TEAM_NAME_ES[m.home_team_name ?? ''] ?? m.home_team_name,
    away_team_name: TEAM_NAME_ES[m.away_team_name ?? ''] ?? m.away_team_name,
  }));

  return NextResponse.json(translated, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
