import type { APIFootballFixture } from '@/types';

const BASE_URL = 'https://v3.football.api-sports.io';
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;

async function apiRequest<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY not configured');

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'x-apisports-key': apiKey },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`API-Football error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.response as T;
}

export async function getWorldCupFixtures(): Promise<APIFootballFixture[]> {
  return apiRequest<APIFootballFixture[]>(
    `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`
  );
}

export async function getLiveFixtures(): Promise<APIFootballFixture[]> {
  return apiRequest<APIFootballFixture[]>(
    `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&live=all`
  );
}

export async function getFinishedFixturesToday(): Promise<APIFootballFixture[]> {
  const today = new Date().toISOString().split('T')[0];
  return apiRequest<APIFootballFixture[]>(
    `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&date=${today}&status=FT`
  );
}

export async function getRecentlyFinishedFixtures(): Promise<APIFootballFixture[]> {
  return apiRequest<APIFootballFixture[]>(
    `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&last=10&status=FT`
  );
}

export async function getTeams(): Promise<Array<{
  team: { id: number; name: string; logo: string };
}>> {
  return apiRequest(`/teams?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`);
}

export function parseStageFromRound(round: string): string {
  if (round.includes('Group')) return 'Group Stage';
  if (round.includes('Round of 32')) return 'Round of 32';
  if (round.includes('Round of 16')) return 'Round of 16';
  if (round.includes('Quarter')) return 'Quarter-finals';
  if (round.includes('Semi')) return 'Semi-finals';
  if (round.includes('3rd')) return 'Third Place';
  if (round.includes('Final')) return 'Final';
  return round;
}

export function parseGroupFromRound(round: string): string | null {
  const match = round.match(/Group\s+([A-L])/i);
  return match ? match[1].toUpperCase() : null;
}
