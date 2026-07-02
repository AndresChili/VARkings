const BASE_URL = 'https://api.football-data.org/v4';

export interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: { id: number; name: string | null; crest: string } | null;
  awayTeam: { id: number; name: string | null; crest: string } | null;
  score: {
    winner: string | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null } | null;
    extraTime?: { home: number | null; away: number | null } | null;
    penalties?: { home: number | null; away: number | null } | null;
  };
}

// football-data.org v4 quirk: for matches decided on penalties, score.fullTime
// includes the shootout goals. Subtract penalties to get the real match score.
export function getFixtureScores(f: FDMatch): {
  home: number | null;
  away: number | null;
  penaltiesHome: number | null;
  penaltiesAway: number | null;
} {
  const ft = f.score.fullTime;
  const pens = f.score.penalties;
  if (
    f.score.duration === 'PENALTY_SHOOTOUT' &&
    pens != null && pens.home != null && pens.away != null &&
    ft.home != null && ft.away != null
  ) {
    return {
      home: ft.home - pens.home,
      away: ft.away - pens.away,
      penaltiesHome: pens.home,
      penaltiesAway: pens.away,
    };
  }
  return { home: ft.home, away: ft.away, penaltiesHome: null, penaltiesAway: null };
}

async function fdRequest<T>(path: string): Promise<T> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY not configured');

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Auth-Token': apiKey },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`football-data.org ${res.status}:`, body);
    throw new Error(`football-data.org error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getWCMatches(): Promise<FDMatch[]> {
  const data = await fdRequest<{ matches: FDMatch[] }>('/competitions/WC/matches?season=2026');
  return data.matches;
}

export async function getLiveWCMatches(): Promise<FDMatch[]> {
  const data = await fdRequest<{ matches: FDMatch[] }>(
    '/competitions/WC/matches?season=2026&status=IN_PLAY,PAUSED'
  );
  return data.matches;
}

export async function getRecentlyFinishedWCMatches(): Promise<FDMatch[]> {
  const today = new Date();
  const windowStart = new Date(today);
  // 3-day window so the daily cron can also repair recently mis-synced results
  windowStart.setDate(windowStart.getDate() - 3);

  const dateTo = today.toISOString().split('T')[0];
  const dateFrom = windowStart.toISOString().split('T')[0];

  const data = await fdRequest<{ matches: FDMatch[] }>(
    `/competitions/WC/matches?season=2026&status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`
  );
  return data.matches;
}

export function mapFDStatus(status: string, duration?: string): string {
  if (status === 'FINISHED') {
    if (duration === 'EXTRA_TIME') return 'AET';
    if (duration === 'PENALTY_SHOOTOUT') return 'PEN';
    return 'FT';
  }
  const map: Record<string, string> = {
    TIMED: 'NS',
    SCHEDULED: 'NS',
    IN_PLAY: '1H',
    PAUSED: 'HT',
    POSTPONED: 'PST',
    SUSPENDED: 'SUSP',
    CANCELLED: 'ABD',
  };
  return map[status] ?? 'NS';
}

export function mapFDStage(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: 'Group Stage',
    LAST_32: 'Round of 32',
    LAST_16: 'Round of 16',
    QUARTER_FINALS: 'Quarter-finals',
    SEMI_FINALS: 'Semi-finals',
    THIRD_PLACE: 'Third Place',
    FINAL: 'Final',
  };
  return map[stage] ?? stage;
}

export function mapFDGroup(group: string | null): string | null {
  if (!group) return null;
  const m = group.match(/GROUP_([A-L])/);
  return m ? m[1] : null;
}
