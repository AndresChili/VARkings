import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast, addHours } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMatchDate(dateString: string): string {
  const date = new Date(dateString);
  return format(date, "d MMM · HH:mm", { locale: es });
}

export function formatMatchDateLong(dateString: string): string {
  const date = new Date(dateString);
  return format(date, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
}

export function timeUntilMatch(dateString: string): string {
  const date = new Date(dateString);
  if (isPast(date)) return 'Partido comenzado';
  return `En ${formatDistanceToNow(date, { locale: es })}`;
}

export function isMatchStarted(dateString: string): boolean {
  return isPast(new Date(dateString));
}

export function isMatchSoon(dateString: string): boolean {
  const date = new Date(dateString);
  const oneHourFromNow = addHours(new Date(), 1);
  return date <= oneHourFromNow && !isPast(date);
}

export function getMatchStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NS: 'No iniciado',
    '1H': 'Primera parte',
    HT: 'Descanso',
    '2H': 'Segunda parte',
    ET: 'Prórroga',
    P: 'Penaltis',
    FT: 'Finalizado',
    AET: 'Finalizado (prórroga)',
    PEN: 'Finalizado (penaltis)',
    SUSP: 'Suspendido',
    PST: 'Pospuesto',
  };
  return labels[status] ?? status;
}

export function isMatchLive(status: string): boolean {
  return ['1H', 'HT', '2H', 'ET', 'P', 'BT'].includes(status);
}

export function isMatchFinished(status: string): boolean {
  return ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(status);
}

export function getWinner(homeScore: number, awayScore: number): 'home' | 'away' | 'draw' {
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function getPointsColor(points: number): string {
  if (points === 3) return 'text-crown';
  if (points === 2) return 'text-field-light';
  if (points === 1) return 'text-blue-400';
  return 'text-gray-500';
}

export function getRankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}º`;
}

export const WC_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export const TOURNAMENT_LOCK_DATE = new Date('2026-06-11T14:00:00Z');

export function isTournamentLocked(): boolean {
  return isPast(TOURNAMENT_LOCK_DATE);
}

export function getTournamentDeadlineText(): string {
  if (isTournamentLocked()) return 'Predicciones bloqueadas';
  return `Cierra ${formatDistanceToNow(TOURNAMENT_LOCK_DATE, { locale: es, addSuffix: true })}`;
}
