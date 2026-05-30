import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getLiveWCMatches, getRecentlyFinishedWCMatches, mapFDStatus } from '@/lib/football-data';
import { calculateMatchPoints } from '@/lib/scoring';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
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

      if (!match || match.status === 'FT' || match.status === 'AET' || match.status === 'PEN') continue;

      const newStatus = mapFDStatus(fixture.status, fixture.score.duration);

      await supabase
        .from('matches')
        .update({ home_score: homeScore, away_score: awayScore, status: newStatus })
        .eq('id', match.id);

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
          awayScore
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
            description: `${fixture.homeTeam.name} ${homeScore}-${awayScore} ${fixture.awayTeam.name}`,
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

    return NextResponse.json({ success: true, updated, live: live.length });
  } catch (error) {
    console.error('Cron update-results error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
