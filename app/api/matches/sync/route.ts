import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getWCMatches, mapFDStatus, mapFDStage, mapFDGroup } from '@/lib/football-data';

function verifyCronSecret(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const received = Buffer.from(header ?? '', 'utf8');
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

export async function POST(req: NextRequest) {
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
    const fixtures = await getWCMatches();

    // Remove previously seeded matches (no api_id) before inserting real ones
    await supabase.from('matches').delete().is('api_id', null);

    const upserts = fixtures
      .filter((f) => f.homeTeam?.name && f.awayTeam?.name)
      .map((f) => ({
        api_id: f.id,
        home_team_name: f.homeTeam.name,
        away_team_name: f.awayTeam.name,
        home_team_logo: f.homeTeam.crest ?? null,
        away_team_logo: f.awayTeam.crest ?? null,
        home_team_api_id: f.homeTeam.id,
        away_team_api_id: f.awayTeam.id,
        match_date: f.utcDate,
        stage: mapFDStage(f.stage),
        group_name: mapFDGroup(f.group),
        home_score: f.score.fullTime.home,
        away_score: f.score.fullTime.away,
        status: mapFDStatus(f.status, f.score.duration),
        venue: null,
      }));

    const { error } = await supabase
      .from('matches')
      .upsert(upserts, { onConflict: 'api_id' });

    if (error) throw error;

    return NextResponse.json({ success: true, matches: upserts.length });
  } catch (error) {
    console.error('Match sync error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
