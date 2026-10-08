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

// Calendario de eliminatorias del Mundial 2026
const matches: KnockoutInsert[] = [
  // Dieciseisavos — 1-4 de julio de 2026 (16 partidos)
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

  // Octavos de final — 7-10 de julio de 2026 (8 partidos)
  ko('2026-07-07', 'Round of 16', 20),
  ko('2026-07-07', 'Round of 16', 23),
  ko('2026-07-08', 'Round of 16', 20),
  ko('2026-07-08', 'Round of 16', 23),
  ko('2026-07-09', 'Round of 16', 20),
  ko('2026-07-09', 'Round of 16', 23),
  ko('2026-07-10', 'Round of 16', 20),
  ko('2026-07-10', 'Round of 16', 23),

  // Cuartos de final — 12-13 de julio de 2026 (4 partidos)
  ko('2026-07-12', 'Quarter-finals', 20),
  ko('2026-07-12', 'Quarter-finals', 23),
  ko('2026-07-13', 'Quarter-finals', 20),
  ko('2026-07-13', 'Quarter-finals', 23),

  // Semifinales — 16-17 de julio de 2026 (2 partidos)
  ko('2026-07-16', 'Semi-finals', 23),
  ko('2026-07-17', 'Semi-finals', 23),

  // Tercer puesto — 19 de julio de 2026
  ko('2026-07-19', 'Third Place', 19),

  // Final — 19 de julio de 2026
  ko('2026-07-19', 'Final', 23),
];

async function seed() {
  // Solo borra los partidos de eliminatoria ya sembrados (api_id nulo + stage distinto de Group Stage)
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
