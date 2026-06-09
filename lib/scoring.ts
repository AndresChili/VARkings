import type { ScoreResult } from '@/types';

export const POINTS = {
  MATCH_WINNER: 1,
  MATCH_HOME_GOALS: 1,
  MATCH_AWAY_GOALS: 1,
  TOURNAMENT_CHAMPION: 20,
  TOURNAMENT_RUNNER_UP: 10,
  TOURNAMENT_THIRD: 5,
  TOURNAMENT_PODIUM_ANY: 3,
  GROUP_BOTH_TEAMS: 5,
  GROUP_ONE_TEAM: 2,
} as const;

export function calculateMatchPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  opts?: {
    predictedKnockoutWinner?: string | null;
    actualKnockoutWinner?: string | null;
  }
): ScoreResult {
  const getWinner = (h: number, a: number) =>
    h > a ? 'home' : a > h ? 'away' : 'draw';

  const predictedResult = getWinner(predictedHome, predictedAway);
  const actualResult = getWinner(actualHome, actualAway);

  // For knockout draws settled by penalties, award winner point based on who the user
  // picked to advance, not on the draw result itself.
  let points_winner: number;
  if (actualResult === 'draw' && opts?.actualKnockoutWinner) {
    points_winner = opts.predictedKnockoutWinner === opts.actualKnockoutWinner
      ? POINTS.MATCH_WINNER
      : 0;
  } else {
    points_winner = predictedResult === actualResult ? POINTS.MATCH_WINNER : 0;
  }

  const points_home_score = predictedHome === actualHome ? POINTS.MATCH_HOME_GOALS : 0;
  const points_away_score = predictedAway === actualAway ? POINTS.MATCH_AWAY_GOALS : 0;

  return {
    points_winner,
    points_home_score,
    points_away_score,
    points_total: points_winner + points_home_score + points_away_score,
  };
}

export function calculateGroupPoints(
  predicted: [string, string],
  actual: [string, string]
): number {
  const matches = predicted.filter((team) => actual.includes(team)).length;
  if (matches === 2) return POINTS.GROUP_BOTH_TEAMS;
  if (matches === 1) return POINTS.GROUP_ONE_TEAM;
  return 0;
}

export function calculateTournamentPoints(params: {
  predictedChampion: string | null;
  predictedRunnerUp: string | null;
  predictedThird: string | null;
  actualChampion: string | null;
  actualRunnerUp: string | null;
  actualThird: string | null;
}): { champion: number; runner_up: number; third_place: number; total: number } {
  const actualPodium = [params.actualChampion, params.actualRunnerUp, params.actualThird].filter(Boolean) as string[];

  function scorePosition(predicted: string | null, exactMatch: string | null, exactPts: number): number {
    if (!predicted) return 0;
    if (predicted === exactMatch) return exactPts;
    if (actualPodium.includes(predicted)) return POINTS.TOURNAMENT_PODIUM_ANY;
    return 0;
  }

  const champion = scorePosition(params.predictedChampion, params.actualChampion, POINTS.TOURNAMENT_CHAMPION);
  const runner_up = scorePosition(params.predictedRunnerUp, params.actualRunnerUp, POINTS.TOURNAMENT_RUNNER_UP);
  const third_place = scorePosition(params.predictedThird, params.actualThird, POINTS.TOURNAMENT_THIRD);

  return { champion, runner_up, third_place, total: champion + runner_up + third_place };
}

export function getMaxMatchPoints(): number {
  return POINTS.MATCH_WINNER + POINTS.MATCH_HOME_GOALS + POINTS.MATCH_AWAY_GOALS;
}

export function getMaxTournamentPoints(): number {
  const podio = POINTS.TOURNAMENT_CHAMPION + POINTS.TOURNAMENT_RUNNER_UP + POINTS.TOURNAMENT_THIRD;
  const groups = 12 * POINTS.GROUP_BOTH_TEAMS;
  return podio + groups;
}
