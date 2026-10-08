// Datos de ejemplo para la demo pública (/demo/**). TODO lo de este archivo es ficticio:
// ningún usuario, grupo, mensaje o predicción proviene de una cuenta real. Los equipos del
// Mundial 2026 son datos públicos; los marcadores y predicciones son inventados a modo de
// ilustración, no afirman resultados reales del torneo.

import type { Team, Match, Group, LeaderboardEntry, Profile, MatchPrediction } from '@/types';
import type { AchievementStats } from '@/lib/achievements';
import { getAchievements } from '@/lib/achievements';
import { getLevelProgress } from '@/lib/xp';
import { calculateMatchPoints } from '@/lib/scoring';
import { WC_GROUPS } from '@/lib/utils';
import { STATIC_WC2026_TEAMS } from '@/lib/teams';

export const DEMO_USER_ID = 'demo-user-0001';
export const DEMO_GROUP_ID = 'demo';

export const DEMO_MEMBERS = [
  { id: DEMO_USER_ID, username: 'jugador_demo', full_name: 'Jugador Demo' },
  { id: 'demo-member-02', username: 'carlos_vk', full_name: 'Carlos V.' },
  { id: 'demo-member-03', username: 'martagol', full_name: 'Marta G.' },
  { id: 'demo-member-04', username: 'raul_pred', full_name: 'Raúl P.' },
  { id: 'demo-member-05', username: 'laura90', full_name: 'Laura' },
  { id: 'demo-member-06', username: 'pablito_k', full_name: 'Pablo K.' },
] as const;

export const DEMO_PROFILE: Profile = {
  id: DEMO_USER_ID,
  username: 'jugador_demo',
  full_name: 'Jugador Demo',
  avatar_url: null,
  created_at: '2026-05-20T10:00:00Z',
  updated_at: '2026-05-20T10:00:00Z',
};

// 48 equipos en 12 grupos de 4, usando los nombres reales del Mundial 2026 (dato público).
export const DEMO_TEAMS: Team[] = STATIC_WC2026_TEAMS.map((t, i) => ({
  id: t.id,
  api_id: t.api_id,
  name: t.name,
  short_name: t.short_name,
  logo_url: null,
  group_name: WC_GROUPS[Math.floor(i / 4) % WC_GROUPS.length],
  created_at: '',
}));

function teamsInGroup(letter: string): Team[] {
  return DEMO_TEAMS.filter((t) => t.group_name === letter);
}

// Clasificados "oficiales" de cada grupo (los 2 primeros, los mejores terceros no cuentan).
export const DEMO_GROUP_QUALIFIERS: Record<string, string[]> = Object.fromEntries(
  WC_GROUPS.map((letter) => [letter, teamsInGroup(letter).slice(0, 2).map((t) => t.name)])
);

type MatchSeed = {
  id: string;
  home: string;
  away: string;
  home_score: number;
  away_score: number;
  stage: string;
  group_name: string | null;
  match_date: string;
  status: 'FT' | 'PEN';
  home_penalties?: number;
  away_penalties?: number;
  winner?: string;
};

const g = (letter: string, idx: number) => teamsInGroup(letter)[idx].name;

const MATCH_SEEDS: MatchSeed[] = [
  { id: 'demo-m1', home: g('A', 0), away: g('A', 1), home_score: 2, away_score: 1, stage: 'Group Stage', group_name: 'A', match_date: '2026-06-12T18:00:00Z', status: 'FT' },
  { id: 'demo-m2', home: g('B', 0), away: g('B', 1), home_score: 1, away_score: 1, stage: 'Group Stage', group_name: 'B', match_date: '2026-06-13T21:00:00Z', status: 'FT' },
  { id: 'demo-m3', home: g('C', 0), away: g('C', 1), home_score: 3, away_score: 0, stage: 'Group Stage', group_name: 'C', match_date: '2026-06-15T15:00:00Z', status: 'FT' },
  { id: 'demo-m4', home: g('D', 0), away: g('D', 1), home_score: 2, away_score: 0, stage: 'Group Stage', group_name: 'D', match_date: '2026-06-17T18:00:00Z', status: 'FT' },
  { id: 'demo-m5', home: g('E', 0), away: g('E', 1), home_score: 2, away_score: 1, stage: 'Round of 32', group_name: null, match_date: '2026-07-01T18:00:00Z', status: 'FT' },
  { id: 'demo-m6', home: g('F', 0), away: g('F', 1), home_score: 1, away_score: 0, stage: 'Round of 32', group_name: null, match_date: '2026-07-02T21:00:00Z', status: 'FT' },
  { id: 'demo-m7', home: g('E', 0), away: g('G', 0), home_score: 3, away_score: 1, stage: 'Round of 16', group_name: null, match_date: '2026-07-07T18:00:00Z', status: 'FT' },
  { id: 'demo-m8', home: g('A', 1), away: g('H', 0), home_score: 1, away_score: 1, stage: 'Round of 16', group_name: null, match_date: '2026-07-08T21:00:00Z', status: 'PEN', home_penalties: 4, away_penalties: 3, winner: g('A', 1) },
  { id: 'demo-m9', home: g('A', 0), away: g('F', 0), home_score: 2, away_score: 2, stage: 'Quarter-finals', group_name: null, match_date: '2026-07-12T18:00:00Z', status: 'PEN', home_penalties: 5, away_penalties: 4, winner: g('A', 0) },
  { id: 'demo-m10', home: g('D', 0), away: g('E', 0), home_score: 1, away_score: 0, stage: 'Quarter-finals', group_name: null, match_date: '2026-07-13T18:00:00Z', status: 'FT' },
  { id: 'demo-m11', home: g('A', 0), away: g('D', 0), home_score: 3, away_score: 1, stage: 'Semi-finals', group_name: null, match_date: '2026-07-16T18:00:00Z', status: 'FT' },
  { id: 'demo-m12', home: g('F', 0), away: g('E', 0), home_score: 2, away_score: 1, stage: '3rd Place Final', group_name: null, match_date: '2026-07-19T14:00:00Z', status: 'FT' },
  { id: 'demo-m13', home: g('A', 0), away: g('A', 1), home_score: 1, away_score: 1, stage: 'Final', group_name: null, match_date: '2026-07-19T18:00:00Z', status: 'PEN', home_penalties: 4, away_penalties: 2, winner: g('A', 0) },
];

export const DEMO_MATCHES: Match[] = MATCH_SEEDS.map((s) => ({
  id: s.id,
  api_id: null,
  home_team_name: s.home,
  away_team_name: s.away,
  home_team_logo: null,
  away_team_logo: null,
  home_team_api_id: null,
  away_team_api_id: null,
  match_date: s.match_date,
  stage: s.stage,
  group_name: s.group_name,
  home_score: s.home_score,
  away_score: s.away_score,
  home_penalties: s.home_penalties ?? null,
  away_penalties: s.away_penalties ?? null,
  winner_team_name: s.winner ?? null,
  status: s.status,
  venue: null,
  created_at: s.match_date,
  updated_at: s.match_date,
}));

type MemberPredRow = {
  predicted_home_score: number;
  predicted_away_score: number;
  predicted_winner: string | null;
  points_winner: number;
  points_home_score: number;
  points_away_score: number;
  points_total: number;
  is_calculated: boolean;
};

// Predicciones por miembro y partido, generadas de forma determinista (no aleatoria) a partir
// del marcador real, con un desvío distinto por miembro para que cada uno acierte en distinta
// medida — simplemente para que la demo se vea variada, no modela comportamiento real de nadie.
function buildMemberPredictions(): Record<string, Record<string, MemberPredRow>> {
  const result: Record<string, Record<string, MemberPredRow>> = {};
  DEMO_MEMBERS.forEach((member, mi) => {
    result[member.id] = {};
    MATCH_SEEDS.forEach((seed, si) => {
      const homeOffset = ((mi + si) % 3) - 1; // -1, 0, 1
      const awayOffset = ((mi * 2 + si) % 3) - 1;
      const predicted_home_score = Math.max(0, seed.home_score + (mi === 0 ? 0 : homeOffset));
      const predicted_away_score = Math.max(0, seed.away_score + (mi === 0 ? 0 : awayOffset));

      let predicted_winner: string | null = null;
      if (predicted_home_score === predicted_away_score && seed.group_name === null) {
        predicted_winner = mi % 2 === 0 ? seed.home : seed.away;
      }

      const points = calculateMatchPoints(predicted_home_score, predicted_away_score, seed.home_score, seed.away_score, {
        predictedKnockoutWinner: predicted_winner,
        actualKnockoutWinner: seed.winner ?? null,
      });

      result[member.id][seed.id] = {
        predicted_home_score,
        predicted_away_score,
        predicted_winner,
        points_winner: points.points_winner,
        points_home_score: points.points_home_score,
        points_away_score: points.points_away_score,
        points_total: points.points_total,
        is_calculated: true,
      };
    });
  });
  return result;
}

export const DEMO_MEMBER_PREDICTIONS = buildMemberPredictions();

// predictionMap para MatchesClient: solo las predicciones del usuario demo.
export const DEMO_PREDICTION_MAP: Record<string, {
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  points_total: number;
  is_calculated: boolean;
}> = Object.fromEntries(
  DEMO_MATCHES.map((m) => {
    const p = DEMO_MEMBER_PREDICTIONS[DEMO_USER_ID][m.id];
    return [m.id, { match_id: m.id, predicted_home_score: p.predicted_home_score, predicted_away_score: p.predicted_away_score, points_total: p.points_total, is_calculated: p.is_calculated }];
  })
);

// matchesWithPredictions para GroupDetailClient: todos los partidos + predicciones de cada miembro.
export const DEMO_MATCHES_WITH_PREDICTIONS = DEMO_MATCHES.map((m) => ({
  ...m,
  memberPredictions: DEMO_MEMBERS.map((member) => ({
    user_id: member.id,
    match_id: m.id,
    predicted_home_score: DEMO_MEMBER_PREDICTIONS[member.id][m.id].predicted_home_score,
    predicted_away_score: DEMO_MEMBER_PREDICTIONS[member.id][m.id].predicted_away_score,
    points_total: DEMO_MEMBER_PREDICTIONS[member.id][m.id].points_total,
    is_calculated: DEMO_MEMBER_PREDICTIONS[member.id][m.id].is_calculated,
  })),
}));

export function getDemoExistingPrediction(matchId: string): MatchPrediction | null {
  const match = DEMO_MATCHES.find((m) => m.id === matchId);
  const pred = DEMO_MEMBER_PREDICTIONS[DEMO_USER_ID]?.[matchId];
  if (!match || !pred) return null;
  return {
    id: `demo-pred-${matchId}`,
    user_id: DEMO_USER_ID,
    match_id: matchId,
    predicted_home_score: pred.predicted_home_score,
    predicted_away_score: pred.predicted_away_score,
    predicted_winner: pred.predicted_winner,
    points_winner: pred.points_winner,
    points_home_score: pred.points_home_score,
    points_away_score: pred.points_away_score,
    points_total: pred.points_total,
    is_calculated: pred.is_calculated,
    created_at: match.match_date,
    updated_at: match.match_date,
  };
}

// Grupo de ejemplo + clasificación interna.
export const DEMO_GROUP: Group = {
  id: DEMO_GROUP_ID,
  name: 'Peña Mundial 2026',
  description: 'Grupo de ejemplo para la demo pública',
  invite_code: 'DEMO2026',
  created_by: DEMO_USER_ID,
  created_at: '2026-05-20T10:00:00Z',
};

const LEADERBOARD_SEED: Record<string, { total: number; matches: number; groups: number; podio: number; level: number }> = {
  [DEMO_USER_ID]: { total: 312, matches: 232, groups: 50, podio: 30, level: 14 },
  'demo-member-02': { total: 298, matches: 228, groups: 45, podio: 25, level: 13 },
  'demo-member-03': { total: 276, matches: 206, groups: 45, podio: 25, level: 12 },
  'demo-member-04': { total: 241, matches: 181, groups: 40, podio: 20, level: 11 },
  'demo-member-05': { total: 198, matches: 148, groups: 35, podio: 15, level: 9 },
  'demo-member-06': { total: 156, matches: 116, groups: 30, podio: 10, level: 7 },
};

export const DEMO_LEADERBOARD: LeaderboardEntry[] = DEMO_MEMBERS
  .map((m) => {
    const s = LEADERBOARD_SEED[m.id];
    return {
      group_id: DEMO_GROUP_ID,
      user_id: m.id,
      username: m.username,
      full_name: m.full_name,
      avatar_url: null,
      total_points: s.total,
      scored_matches: 60,
      calculated_matches: 60,
      total_predictions: 62,
      podio_points: s.podio,
      groups_points: s.groups,
      matches_points: s.matches,
    };
  })
  .sort((a, b) => b.total_points - a.total_points);

export const DEMO_MEMBER_LEVELS: Record<string, number> = Object.fromEntries(
  DEMO_MEMBERS.map((m) => [m.id, LEADERBOARD_SEED[m.id].level])
);

// Podio del torneo elegido por cada miembro dentro del grupo.
export const DEMO_CHAMPION_PICKS: Record<string, { champion: string | null; runner_up: string | null; third_place: string | null }> = {
  [DEMO_USER_ID]: { champion: g('A', 0), runner_up: g('A', 1), third_place: g('F', 0) },
  'demo-member-02': { champion: g('A', 0), runner_up: g('D', 0), third_place: g('E', 0) },
  'demo-member-03': { champion: g('F', 0), runner_up: g('A', 0), third_place: g('A', 1) },
  'demo-member-04': { champion: g('A', 1), runner_up: g('A', 0), third_place: g('D', 0) },
  'demo-member-05': { champion: g('D', 0), runner_up: g('E', 0), third_place: g('A', 0) },
  'demo-member-06': { champion: g('E', 0), runner_up: g('F', 0), third_place: g('A', 1) },
};

export const DEMO_MY_PODIO = DEMO_CHAMPION_PICKS[DEMO_USER_ID];

export const DEMO_TOURNAMENT_PREDICTION = {
  champion: DEMO_MY_PODIO.champion,
  runner_up: DEMO_MY_PODIO.runner_up,
  third_place: DEMO_MY_PODIO.third_place,
};

// Predicciones de clasificados por grupo de cada miembro (2 equipos por grupo).
export const DEMO_MEMBER_GROUP_PICKS: Record<string, Record<string, string[]>> = Object.fromEntries(
  DEMO_MEMBERS.map((member, mi) => [
    member.id,
    Object.fromEntries(
      WC_GROUPS.map((letter, gi) => {
        const teams = teamsInGroup(letter);
        const correct = (mi + gi) % 4 !== 0;
        const picks = correct ? [teams[0].name, teams[1].name] : [teams[0].name, teams[2].name];
        return [letter, picks];
      })
    ),
  ])
);

// Una solicitud de ingreso pendiente de ejemplo, para mostrar esa parte de la gestión del grupo.
export const DEMO_PENDING_REQUESTS = [
  { user_id: 'demo-pending-01', username: 'diego_fan', created_at: '2026-07-20T09:00:00Z' },
];

// Estadísticas y logros de ejemplo (perfil/logros).
export const DEMO_ACHIEVEMENT_STATS: AchievementStats = {
  totalPredictions: 78,
  exactPredictions: 14,
  hasTournamentPrediction: true,
  groupPredictionsCount: 12,
  friendsCount: 6,
  groupsCreated: 2,
  maxGroupMembers: 6,
  totalPoints: 312,
  totalXP: 1800,
  totalMatches: 104,
  hasAvatar: false,
  currentStreak: 5,
  maxStreak: 21,
  totalDaysActive: 34,
};

export const DEMO_ACHIEVEMENTS = getAchievements(DEMO_ACHIEVEMENT_STATS);
export const DEMO_EARNED_IDS = DEMO_ACHIEVEMENTS.filter((a) => a.current >= a.target).map((a) => a.id);
export const DEMO_LEVEL_PROGRESS = getLevelProgress(DEMO_ACHIEVEMENT_STATS.totalXP);

export const DEMO_PROFILE_STATS = {
  totalPredictions: DEMO_ACHIEVEMENT_STATS.totalPredictions,
  calculatedPredictions: 76,
  matchPoints: 232,
  winnerHits: 52,
  exactHits: DEMO_ACHIEVEMENT_STATS.exactPredictions,
  teamGoalHits: 68,
  groupTeamsCorrect: 20,
  podioExactHits: 2,
  podioAnyHits: 1,
  tournamentPoints: 80,
};

// Amigos de ejemplo (para /demo/friends).
export const DEMO_FRIEND_PROFILES = [
  ...DEMO_MEMBERS.slice(1).map((m) => ({
    id: m.id,
    username: m.username,
    full_name: m.full_name,
    avatar_url: null as string | null,
  })),
  { id: 'demo-pending-friend', username: 'nico_vk', full_name: 'Nico', avatar_url: null as string | null },
];

export const DEMO_FRIENDSHIPS = [
  ...DEMO_MEMBERS.slice(1).map((m, i) => ({
    id: `demo-friendship-${i}`,
    requester_id: DEMO_USER_ID,
    addressee_id: m.id,
    status: 'accepted' as const,
    created_at: '2026-06-01T10:00:00Z',
  })),
  {
    id: 'demo-friendship-pending',
    requester_id: 'demo-pending-friend',
    addressee_id: DEMO_USER_ID,
    status: 'pending' as const,
    created_at: '2026-07-21T10:00:00Z',
  },
];

export const DEMO_FRIEND_XP_MAP: Record<string, number> = {
  ...Object.fromEntries(DEMO_MEMBERS.map((m) => [m.id, LEADERBOARD_SEED[m.id].total * 5])),
  'demo-pending-friend': 420,
};
export const DEMO_FRIEND_POINTS_MAP: Record<string, number> = {
  ...Object.fromEntries(DEMO_MEMBERS.map((m) => [m.id, LEADERBOARD_SEED[m.id].total])),
  'demo-pending-friend': 84,
};

// Perfil público de "otro miembro" para /demo/users/[id].
export function getDemoOtherProfile(id: string) {
  const member = DEMO_MEMBERS.find((m) => m.id === id) ?? DEMO_MEMBERS[1];
  const seed = LEADERBOARD_SEED[member.id];
  return {
    profile: { id: member.id, username: member.username, full_name: member.full_name, avatar_url: null as string | null },
    levelProgress: getLevelProgress(seed.level * 130),
    stats: {
      matchPoints: seed.matches,
      winnerHits: Math.round(seed.matches / 4),
      exactHits: Math.round(seed.matches / 15),
      teamGoalHits: Math.round(seed.matches / 3),
      groupTeamsCorrect: Math.round(seed.groups / 5),
      podioExactHits: seed.podio >= 25 ? 1 : 0,
      podioAnyHits: 1,
    },
  };
}
