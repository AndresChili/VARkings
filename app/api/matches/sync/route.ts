import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getWorldCupFixtures, getTeams, parseStageFromRound, parseGroupFromRound } from '@/lib/api-football';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Sync teams first
    const teamsData = await getTeams();
    if (teamsData.length > 0) {
      const teamUpserts = teamsData.map((t) => ({
        api_id: t.team.id,
        name: t.team.name,
        logo_url: t.team.logo,
      }));
      const { error: teamsError } = await supabase
        .from('teams')
        .upsert(teamUpserts, { onConflict: 'api_id' });
      if (teamsError) throw teamsError;
    }

    // Sync matches
    const fixtures = await getWorldCupFixtures();
    const upserts = fixtures.map((f) => ({
      api_id: f.fixture.id,
      home_team_name: f.teams.home.name,
      away_team_name: f.teams.away.name,
      home_team_logo: f.teams.home.logo,
      away_team_logo: f.teams.away.logo,
      home_team_api_id: f.teams.home.id,
      away_team_api_id: f.teams.away.id,
      match_date: f.fixture.date,
      stage: parseStageFromRound(f.league.round),
      group_name: parseGroupFromRound(f.league.round),
      home_score: f.score.fulltime.home,
      away_score: f.score.fulltime.away,
      status: f.fixture.status.short,
      venue: f.fixture.venue?.name ?? null,
    }));

    const { error, count } = await supabase
      .from('matches')
      .upsert(upserts, { onConflict: 'api_id' });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      teams: teamsData.length,
      matches: count ?? upserts.length,
    });
  } catch (error) {
    console.error('Match sync error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
