import { createAdminClient } from '@/lib/supabase/server';
import { TEAM_NAME_ES } from '@/lib/teams';

const FINISHED = ['FT', 'AET', 'PEN'];

interface TeamStats {
  pts: number;
  gd: number;
  gf: number;
}

/**
 * Top-2 finishers per group (Spanish team names), computed from finished
 * group-stage results in the DB. Groups with unplayed matches are omitted,
 * so provisional tables never mark predictions right/wrong early.
 *
 * Ranking: points, goal difference, goals for, then head-to-head result.
 * Best third-placed teams also advance to the Round of 32, but they do NOT
 * count for group predictions — only the top 2 of each group.
 */
export async function getGroupQualifiers(): Promise<Record<string, string[]>> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from('matches')
    .select('home_team_name, away_team_name, home_score, away_score, group_name, status')
    .eq('stage', 'Group Stage')
    .not('group_name', 'is', null);

  if (!rows?.length) return {};

  const byGroup = new Map<string, typeof rows>();
  for (const m of rows) {
    if (!m.group_name) continue;
    if (!byGroup.has(m.group_name)) byGroup.set(m.group_name, []);
    byGroup.get(m.group_name)!.push(m);
  }

  const qualifiers: Record<string, string[]> = {};

  for (const [group, matches] of byGroup) {
    const allFinished = matches.every(
      (m) =>
        m.home_team_name && m.away_team_name &&
        FINISHED.includes(m.status) &&
        m.home_score !== null && m.away_score !== null
    );
    if (!allFinished) continue;

    const stats = new Map<string, TeamStats>();
    // head-to-head winner: "loserTeam|winnerTeam" not needed; store per pair
    const h2hWinner = new Map<string, string>(); // "A|B" (sorted) -> winner name or ''

    for (const m of matches) {
      const home = m.home_team_name!;
      const away = m.away_team_name!;
      const hs = m.home_score!;
      const as_ = m.away_score!;

      for (const t of [home, away]) {
        if (!stats.has(t)) stats.set(t, { pts: 0, gd: 0, gf: 0 });
      }
      const h = stats.get(home)!;
      const a = stats.get(away)!;
      h.gf += hs; h.gd += hs - as_;
      a.gf += as_; a.gd += as_ - hs;
      if (hs > as_) h.pts += 3;
      else if (as_ > hs) a.pts += 3;
      else { h.pts += 1; a.pts += 1; }

      const pairKey = [home, away].sort().join('|');
      h2hWinner.set(pairKey, hs > as_ ? home : as_ > hs ? away : '');
    }

    const ranked = Array.from(stats.keys()).sort((t1, t2) => {
      const s1 = stats.get(t1)!;
      const s2 = stats.get(t2)!;
      if (s2.pts !== s1.pts) return s2.pts - s1.pts;
      if (s2.gd !== s1.gd) return s2.gd - s1.gd;
      if (s2.gf !== s1.gf) return s2.gf - s1.gf;
      const winner = h2hWinner.get([t1, t2].sort().join('|'));
      if (winner === t1) return -1;
      if (winner === t2) return 1;
      return 0;
    });

    if (ranked.length >= 2) {
      qualifiers[group] = ranked
        .slice(0, 2)
        .map((name) => TEAM_NAME_ES[name] ?? name);
    }
  }

  return qualifiers;
}
