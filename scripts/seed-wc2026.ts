import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ijfegixwnuogkqhcbagc.supabase.co',
  'sb_secret_hDvAOnyZMfR2zYiShEZFgA_fOTZ3lQ2'
);

const flag = (code: string) => `https://flagcdn.com/w80/${code}.png`;

type MatchInsert = {
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string;
  away_team_logo: string;
  match_date: string;
  stage: string;
  group_name: string | null;
  status: string;
  home_score: null;
  away_score: null;
  venue: string | null;
};

const TEAM_FLAGS: Record<string, string> = {
  'Mexico': flag('mx'),
  'South Africa': flag('za'),
  'South Korea': flag('kr'),
  'Czechia': flag('cz'),
  'Canada': flag('ca'),
  'Bosnia and Herzegovina': flag('ba'),
  'Qatar': flag('qa'),
  'Switzerland': flag('ch'),
  'Brazil': flag('br'),
  'Morocco': flag('ma'),
  'Haiti': flag('ht'),
  'Scotland': flag('gb-sct'),
  'USA': flag('us'),
  'Paraguay': flag('py'),
  'Australia': flag('au'),
  'Turkiye': flag('tr'),
  'Germany': flag('de'),
  'Curacao': flag('cw'),
  'Ivory Coast': flag('ci'),
  'Ecuador': flag('ec'),
  'Netherlands': flag('nl'),
  'Japan': flag('jp'),
  'Sweden': flag('se'),
  'Tunisia': flag('tn'),
  'Iran': flag('ir'),
  'New Zealand': flag('nz'),
  'Belgium': flag('be'),
  'Egypt': flag('eg'),
  'Spain': flag('es'),
  'Cape Verde': flag('cv'),
  'Saudi Arabia': flag('sa'),
  'Uruguay': flag('uy'),
  'France': flag('fr'),
  'Senegal': flag('sn'),
  'Iraq': flag('iq'),
  'Norway': flag('no'),
  'Argentina': flag('ar'),
  'Algeria': flag('dz'),
  'Austria': flag('at'),
  'Jordan': flag('jo'),
  'Portugal': flag('pt'),
  'DR Congo': flag('cd'),
  'Uzbekistan': flag('uz'),
  'Colombia': flag('co'),
  'England': flag('gb-eng'),
  'Croatia': flag('hr'),
  'Ghana': flag('gh'),
  'Panama': flag('pa'),
};

function match(
  date: string,
  home: string,
  away: string,
  group: string,
  hour = 19
): MatchInsert {
  return {
    home_team_name: home,
    away_team_name: away,
    home_team_logo: TEAM_FLAGS[home] ?? null,
    away_team_logo: TEAM_FLAGS[away] ?? null,
    match_date: `${date}T${String(hour).padStart(2, '0')}:00:00Z`,
    stage: 'Group Stage',
    group_name: group,
    status: 'NS',
    home_score: null,
    away_score: null,
    venue: null,
  };
}

const matches: MatchInsert[] = [
  // ── MATCHDAY 1 ────────────────────────────────────────────────
  // Jun 11 – Group A
  match('2026-06-11', 'Mexico', 'South Africa', 'A', 19),
  match('2026-06-11', 'South Korea', 'Czechia', 'A', 22),
  // Jun 12 – Group B, D
  match('2026-06-12', 'Canada', 'Bosnia and Herzegovina', 'B', 19),
  match('2026-06-12', 'USA', 'Paraguay', 'D', 22),
  // Jun 13 – Group B, C, D
  match('2026-06-13', 'Qatar', 'Switzerland', 'B', 15),
  match('2026-06-13', 'Brazil', 'Morocco', 'C', 18),
  match('2026-06-13', 'Haiti', 'Scotland', 'C', 21),
  match('2026-06-13', 'Australia', 'Turkiye', 'D', 0),
  // Jun 14 – Group E, F
  match('2026-06-14', 'Germany', 'Curacao', 'E', 15),
  match('2026-06-14', 'Ivory Coast', 'Ecuador', 'E', 18),
  match('2026-06-14', 'Netherlands', 'Japan', 'F', 21),
  match('2026-06-14', 'Sweden', 'Tunisia', 'F', 0),
  // Jun 15 – Group G, H
  match('2026-06-15', 'Iran', 'New Zealand', 'G', 15),
  match('2026-06-15', 'Belgium', 'Egypt', 'G', 18),
  match('2026-06-15', 'Spain', 'Cape Verde', 'H', 21),
  match('2026-06-15', 'Saudi Arabia', 'Uruguay', 'H', 0),
  // Jun 16 – Group I, J
  match('2026-06-16', 'France', 'Senegal', 'I', 15),
  match('2026-06-16', 'Iraq', 'Norway', 'I', 18),
  match('2026-06-16', 'Argentina', 'Algeria', 'J', 21),
  match('2026-06-16', 'Austria', 'Jordan', 'J', 0),
  // Jun 17 – Group K, L
  match('2026-06-17', 'Portugal', 'DR Congo', 'K', 15),
  match('2026-06-17', 'Uzbekistan', 'Colombia', 'K', 18),
  match('2026-06-17', 'England', 'Croatia', 'L', 21),
  match('2026-06-17', 'Ghana', 'Panama', 'L', 0),

  // ── MATCHDAY 2 ────────────────────────────────────────────────
  // Jun 18 – Group A, B
  match('2026-06-18', 'Czechia', 'South Africa', 'A', 15),
  match('2026-06-18', 'Mexico', 'South Korea', 'A', 18),
  match('2026-06-18', 'Switzerland', 'Bosnia and Herzegovina', 'B', 21),
  match('2026-06-18', 'Canada', 'Qatar', 'B', 0),
  // Jun 19 – Group C, D
  match('2026-06-19', 'Scotland', 'Morocco', 'C', 15),
  match('2026-06-19', 'Brazil', 'Haiti', 'C', 18),
  match('2026-06-19', 'USA', 'Australia', 'D', 21),
  match('2026-06-19', 'Turkiye', 'Paraguay', 'D', 0),
  // Jun 20 – Group E, F
  match('2026-06-20', 'Germany', 'Ivory Coast', 'E', 15),
  match('2026-06-20', 'Ecuador', 'Curacao', 'E', 18),
  match('2026-06-20', 'Netherlands', 'Sweden', 'F', 21),
  match('2026-06-20', 'Tunisia', 'Japan', 'F', 0),
  // Jun 21 – Group G, H
  match('2026-06-21', 'Belgium', 'Iran', 'G', 15),
  match('2026-06-21', 'New Zealand', 'Egypt', 'G', 18),
  match('2026-06-21', 'Spain', 'Saudi Arabia', 'H', 21),
  match('2026-06-21', 'Uruguay', 'Cape Verde', 'H', 0),
  // Jun 22 – Group I, J
  match('2026-06-22', 'France', 'Iraq', 'I', 15),
  match('2026-06-22', 'Norway', 'Senegal', 'I', 18),
  match('2026-06-22', 'Argentina', 'Austria', 'J', 21),
  match('2026-06-22', 'Jordan', 'Algeria', 'J', 0),
  // Jun 23 – Group K, L
  match('2026-06-23', 'Portugal', 'Uzbekistan', 'K', 15),
  match('2026-06-23', 'Colombia', 'DR Congo', 'K', 18),
  match('2026-06-23', 'England', 'Ghana', 'L', 21),
  match('2026-06-23', 'Panama', 'Croatia', 'L', 0),

  // ── MATCHDAY 3 (simultaneous within group) ────────────────────
  // Jun 24 – Group A, B, C
  match('2026-06-24', 'Czechia', 'Mexico', 'A', 18),
  match('2026-06-24', 'South Africa', 'South Korea', 'A', 18),
  match('2026-06-24', 'Switzerland', 'Canada', 'B', 18),
  match('2026-06-24', 'Bosnia and Herzegovina', 'Qatar', 'B', 18),
  match('2026-06-24', 'Scotland', 'Brazil', 'C', 22),
  match('2026-06-24', 'Morocco', 'Haiti', 'C', 22),
  // Jun 25 – Group D, E, F
  match('2026-06-25', 'Turkiye', 'USA', 'D', 18),
  match('2026-06-25', 'Paraguay', 'Australia', 'D', 18),
  match('2026-06-25', 'Ecuador', 'Germany', 'E', 18),
  match('2026-06-25', 'Curacao', 'Ivory Coast', 'E', 18),
  match('2026-06-25', 'Japan', 'Sweden', 'F', 22),
  match('2026-06-25', 'Tunisia', 'Netherlands', 'F', 22),
  // Jun 26 – Group G, H, I
  match('2026-06-26', 'Egypt', 'Iran', 'G', 18),
  match('2026-06-26', 'New Zealand', 'Belgium', 'G', 18),
  match('2026-06-26', 'Cape Verde', 'Saudi Arabia', 'H', 18),
  match('2026-06-26', 'Uruguay', 'Spain', 'H', 18),
  match('2026-06-26', 'Norway', 'France', 'I', 22),
  match('2026-06-26', 'Senegal', 'Iraq', 'I', 22),
  // Jun 27 – Group J, K, L
  match('2026-06-27', 'Algeria', 'Austria', 'J', 18),
  match('2026-06-27', 'Jordan', 'Argentina', 'J', 18),
  match('2026-06-27', 'Colombia', 'Portugal', 'K', 18),
  match('2026-06-27', 'DR Congo', 'Uzbekistan', 'K', 18),
  match('2026-06-27', 'Panama', 'England', 'L', 22),
  match('2026-06-27', 'Croatia', 'Ghana', 'L', 22),
];

async function seed() {
  // Clear existing seeded matches (no api_id) to allow re-runs
  const { error: delError } = await supabase
    .from('matches')
    .delete()
    .is('api_id', null);

  if (delError) {
    console.error('Delete error:', delError.message);
    process.exit(1);
  }

  console.log(`Inserting ${matches.length} matches...`);

  const { error } = await supabase.from('matches').insert(matches);

  if (error) {
    console.error('Insert error:', error.message);
    process.exit(1);
  }

  console.log(`Done! Inserted ${matches.length} WC2026 group stage matches.`);
}

seed();
