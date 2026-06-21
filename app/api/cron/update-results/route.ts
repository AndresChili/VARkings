import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getLiveWCMatches, getRecentlyFinishedWCMatches, mapFDStatus } from '@/lib/football-data';
import { calculateMatchPoints } from '@/lib/scoring';

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

    // Update finished matches and calculate points
    const finished = await getRecentlyFinishedWCMatches();

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
      const alreadyFinished = match.status === 'FT' || match.status === 'AET' || match.status === 'PEN';

      const newStatus = mapFDStatus(fixture.status, fixture.score.duration);
      const winnerName = fixture.score.winner === 'HOME_TEAM'
        ? (fixture.homeTeam?.name ?? null)
        : fixture.score.winner === 'AWAY_TEAM'
        ? (fixture.awayTeam?.name ?? null)
        : null;

      if (!alreadyFinished) {
        await supabase
          .from('matches')
          .update({ home_score: homeScore, away_score: awayScore, status: newStatus, winner_team_name: winnerName })
          .eq('id', match.id);
      } else if (winnerName) {
        await supabase
          .from('matches')
          .update({ winner_team_name: winnerName })
          .eq('id', match.id);
      }

      const { data: predictions } = await supabase
        .from('match_predictions')
        .select('id, user_id, predicted_home_score, predicted_away_score, predicted_winner')
        .eq('match_id', match.id)
        .eq('is_calculated', false);

      if (!predictions?.length) continue;

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

    // Update live match statuses
    const live = await getLiveWCMatches();
    for (const fixture of live) {
      await supabase
        .from('matches')
        .update({ status: mapFDStatus(fixture.status) })
        .eq('api_id', fixture.id);
    }

    revalidateTag('matches');
    return NextResponse.json({ success: true, updated, live: live.length });
  } catch (error) {
    console.error('Cron update-results error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
