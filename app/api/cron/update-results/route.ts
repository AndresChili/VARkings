import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getLiveWCMatches, getRecentlyFinishedWCMatches, getWCMatches, getFixtureScores, mapFDStatus, mapFDStage, mapFDGroup } from '@/lib/football-data';
import { calculateMatchPoints, calculateTournamentPoints } from '@/lib/scoring';
import { TEAM_NAME_ES } from '@/lib/teams';

function verifyCronSecret(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const received = Buffer.from(header ?? '', 'utf8');
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  if (!verifyCronSecret(authHeader, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    let updated = 0;

    // Resolve pending knockout pairings: /api/matches only syncs team names
    // while clients are polling (live matches), so pairings decided by the
    // day's last games would otherwise stay unnamed until the next kickoff.
    const { data: unnamedKnockout } = await supabase
      .from('matches')
      .select('id')
      .neq('stage', 'Group Stage')
      .or('home_team_name.is.null,away_team_name.is.null')
      .limit(1);

    if (unnamedKnockout && unnamedKnockout.length > 0) {
      const allFixtures = await getWCMatches();
      const knockoutUpserts = allFixtures.map((f) => ({
        api_id: f.id,
        home_team_name: f.homeTeam?.name || null,
        away_team_name: f.awayTeam?.name || null,
        home_team_logo: f.homeTeam?.crest ?? null,
        away_team_logo: f.awayTeam?.crest ?? null,
        match_date: f.utcDate,
        stage: mapFDStage(f.stage),
        group_name: mapFDGroup(f.group),
        status: mapFDStatus(f.status, f.score.duration),
      }));
      if (knockoutUpserts.length > 0) {
        await supabase.from('matches').upsert(knockoutUpserts, { onConflict: 'api_id' });
      }
    }

    // Update finished matches and calculate points
    const finished = await getRecentlyFinishedWCMatches();

    for (const fixture of finished) {
      const { home: homeScore, away: awayScore, penaltiesHome, penaltiesAway } = getFixtureScores(fixture);
      if (homeScore === null || awayScore === null) continue;

      const { data: match } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score, home_penalties, winner_team_name')
        .eq('api_id', fixture.id)
        .maybeSingle();

      if (!match) continue;
      const alreadyFinished = match.status === 'FT' || match.status === 'AET' || match.status === 'PEN';
      const scoresAreMissing = match.home_score === null || match.away_score === null;
      // Repair rows saved before penalty handling: DB score included shootout goals
      const scoresAreWrong = !scoresAreMissing &&
        (match.home_score !== homeScore || match.away_score !== awayScore ||
          (penaltiesHome !== null && match.home_penalties === null));

      const newStatus = mapFDStatus(fixture.status, fixture.score.duration);
      const winnerName = fixture.score.winner === 'HOME_TEAM'
        ? (fixture.homeTeam?.name ?? null)
        : fixture.score.winner === 'AWAY_TEAM'
        ? (fixture.awayTeam?.name ?? null)
        : null;

      if (!alreadyFinished || scoresAreMissing || scoresAreWrong) {
        await supabase
          .from('matches')
          .update({
            home_score: homeScore,
            away_score: awayScore,
            home_penalties: penaltiesHome,
            away_penalties: penaltiesAway,
            status: newStatus,
            winner_team_name: winnerName,
          })
          .eq('id', match.id);
      } else if (winnerName && match.winner_team_name !== winnerName) {
        await supabase
          .from('matches')
          .update({ winner_team_name: winnerName })
          .eq('id', match.id);
      }

      // If scores were repaired, recalculate every prediction (they were scored
      // against the wrong result) and rebuild the points log for this match.
      const forceRecalc = alreadyFinished && scoresAreWrong;
      let predQuery = supabase
        .from('match_predictions')
        .select('id, user_id, predicted_home_score, predicted_away_score, predicted_winner')
        .eq('match_id', match.id);
      if (!forceRecalc) predQuery = predQuery.eq('is_calculated', false);
      const { data: predictions } = await predQuery;

      if (!predictions?.length) continue;

      if (forceRecalc) {
        await supabase
          .from('points_log')
          .delete()
          .eq('match_id', match.id)
          .eq('reason', 'match_prediction');
      }

      for (const pred of predictions ?? []) {
        const result = calculateMatchPoints(
          pred.predicted_home_score,
          pred.predicted_away_score,
          homeScore,
          awayScore,
          {
            predictedKnockoutWinner: pred.predicted_winner ?? null,
            actualKnockoutWinner: winnerName,
          }
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

      updated++;
    }

    // Update live match statuses and scores
    const live = await getLiveWCMatches();
    for (const fixture of live) {
      const { home: liveHome, away: liveAway } = getFixtureScores(fixture);
      await supabase
        .from('matches')
        .update({
          status: mapFDStatus(fixture.status),
          ...(liveHome !== null && liveAway !== null
            ? { home_score: liveHome, away_score: liveAway }
            : {}),
        })
        .eq('api_id', fixture.id);
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
        .from('group_tournament_predictions')
        .select('id, champion, runner_up, third_place, is_calculated');

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
          .from('group_tournament_predictions')
          .update({
            champion_points: result.champion,
            runner_up_points: result.runner_up,
            third_place_points: result.third_place,
            is_calculated: true,
          })
          .eq('id', pred.id);
      }
    }

    revalidateTag('matches');
    return NextResponse.json({ success: true, updated, live: live.length });
  } catch (error) {
    console.error('Cron update-results error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
