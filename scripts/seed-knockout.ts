import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type KnockoutInsert = {
  home_team_name: null;
  away_team_name: null;
  home_team_logo: null;
  away_team_logo: null;
  match_date: string;
  stage: string;
  group_name: null;
  status: string;
  home_score: null;
  away_score: null;
  venue: null;
};

function ko(date: string, stage: string, hour = 19): KnockoutInsert {
  return {
    home_team_name: null,
    away_team_name: null,
    home_team_logo: null,
    away_team_logo: null,
    match_date: `${date}T${String(hour).padStart(2, '0')}:00:00Z`,
    stage,
    group_name: null,
    status: 'NS',
    home_score: null,
    away_score: null,
    venue: null,
  };
}

// WC2026 knockout schedule
const matches: KnockoutInsert[] = [
  // Round of 32 — July 1-4, 2026 (16 matches)
  ko('2026-07-01', 'Round of 32', 17),
  ko('2026-07-01', 'Round of 32', 20),
  ko('2026-07-01', 'Round of 32', 23),
  ko('2026-07-02', 'Round of 32', 17),
  ko('2026-07-02', 'Round of 32', 20),
  ko('2026-07-02', 'Round of 32', 23),
  ko('2026-07-03', 'Round of 32', 17),
  ko('2026-07-03', 'Round of 32', 20),
  ko('2026-07-03', 'Round of 32', 23),
  ko('2026-07-04', 'Round of 32', 17),
  ko('2026-07-04', 'Round of 32', 20),
  ko('2026-07-04', 'Round of 32', 23),
  ko('2026-07-05', 'Round of 32', 17),
  ko('2026-07-05', 'Round of 32', 20),
  ko('2026-07-05', 'Round of 32', 23),
  ko('2026-07-06', 'Round of 32', 20),

  // Round of 16 — July 7-10, 2026 (8 matches)
  ko('2026-07-07', 'Round of 16', 20),
  ko('2026-07-07', 'Round of 16', 23),
  ko('2026-07-08', 'Round of 16', 20),
  ko('2026-07-08', 'Round of 16', 23),
  ko('2026-07-09', 'Round of 16', 20),
  ko('2026-07-09', 'Round of 16', 23),
  ko('2026-07-10', 'Round of 16', 20),
  ko('2026-07-10', 'Round of 16', 23),

  // Quarterfinals — July 12-13, 2026 (4 matches)
  ko('2026-07-12', 'Quarter-finals', 20),
  ko('2026-07-12', 'Quarter-finals', 23),
  ko('2026-07-13', 'Quarter-finals', 20),
  ko('2026-07-13', 'Quarter-finals', 23),

  // Semifinals — July 16-17, 2026 (2 matches)
  ko('2026-07-16', 'Semi-finals', 23),
  ko('2026-07-17', 'Semi-finals', 23),

  // Third Place — July 19, 2026
  ko('2026-07-19', 'Third Place', 19),

  // Final — July 19, 2026
  ko('2026-07-19', 'Final', 23),
];

async function seed() {
  // Only delete existing knockout stubs (api_id null + stage not Group Stage)
  const { error: delError } = await supabase
    .from('matches')
    .delete()
    .is('api_id', null)
    .neq('stage', 'Group Stage');

  if (delError) {
    console.error('Delete error:', delError.message);
    process.exit(1);
  }

  console.log(`Inserting ${matches.length} knockout matches...`);
  const { error } = await supabase.from('matches').insert(matches);
  if (error) {
    console.error('Insert error:', error.message);
    process.exit(1);
  }

  console.log(`Done! Inserted ${matches.length} knockout matches.`);
}

seed();
