'use client';

import Link from 'next/link';
import { Trophy, Users, Calendar, ChevronRight, AlertCircle } from 'lucide-react';
import type { Profile, Match } from '@/types';
import { formatMatchDate, getTournamentDeadlineText, isTournamentLocked } from '@/lib/utils';

interface DashboardClientProps {
  profile: Profile | null;
  groups: Array<{ group_id: string; groups: { id: string; name: string; description: string | null } | null }>;
  upcomingMatches: Match[];
  tournamentPrediction: { id: string; champion: string | null; runner_up: string | null; third_place: string | null } | null;
  totalPoints: number;
}

export function DashboardClient({
  profile,
  groups,
  upcomingMatches,
  tournamentPrediction,
  totalPoints,
}: DashboardClientProps) {
  const locked = isTournamentLocked();
  const needsTournamentPrediction = !tournamentPrediction && !locked;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-5 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          ¡Hola, {profile?.username ?? 'vikingo'}! 👋
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {locked ? 'El Mundial ya ha comenzado' : getTournamentDeadlineText()}
        </p>
      </div>

      {/* Tournament prediction alert */}
      {needsTournamentPrediction && (
        <Link href="/predictions">
          <div className="bg-crown/10 border border-crown/30 rounded-2xl p-4 flex items-start gap-3 card-hover">
            <AlertCircle className="text-crown mt-0.5 shrink-0" size={20} />
            <div className="flex-1 min-w-0">
              <p className="text-crown font-semibold text-sm">¡Predicciones del torneo pendientes!</p>
              <p className="text-gray-400 text-xs mt-0.5">
                Elige tu campeón, podio y clasificados. {getTournamentDeadlineText()}.
              </p>
            </div>
            <ChevronRight className="text-crown shrink-0" size={16} />
          </div>
        </Link>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-card border border-white/10 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-crown">{totalPoints}</div>
          <div className="text-xs text-gray-400 mt-0.5">Puntos</div>
        </div>
        <div className="bg-surface-card border border-white/10 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-field-light">{groups.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Grupos</div>
        </div>
        <div className="bg-surface-card border border-white/10 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-blue-400">{upcomingMatches.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Próximos</div>
        </div>
      </div>

      {/* My groups */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users size={18} className="text-field-light" />
            Mis grupos
          </h2>
          <Link href="/groups" className="text-sm text-crown hover:text-crown-light transition-colors">
            Ver todos
          </Link>
        </div>

        {groups.length === 0 ? (
          <div className="bg-surface-card border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-gray-400 text-sm mb-3">No estás en ningún grupo todavía</p>
            <Link href="/groups" className="text-crown text-sm font-medium hover:underline">
              Crear o unirse a un grupo →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.slice(0, 3).map((m) => {
              if (!m.groups) return null;
              return (
                <Link key={m.group_id} href={`/groups/${m.groups.id}`}>
                  <div className="bg-surface-card border border-white/10 rounded-2xl p-4 flex items-center justify-between card-hover">
                    <div>
                      <p className="font-semibold text-white">{m.groups.name}</p>
                      {m.groups.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{m.groups.description}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-gray-500" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming matches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar size={18} className="text-field-light" />
            Próximos partidos
          </h2>
          <Link href="/matches" className="text-sm text-crown hover:text-crown-light transition-colors">
            Ver todos
          </Link>
        </div>

        {upcomingMatches.length === 0 ? (
          <div className="bg-surface-card border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-gray-400 text-sm">No hay partidos próximos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingMatches.slice(0, 3).map((match) => (
              <Link key={match.id} href={`/matches/${match.id}`}>
                <div className="bg-surface-card border border-white/10 rounded-2xl p-4 card-hover">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 bg-surface rounded px-2 py-0.5">
                      {match.stage}{match.group_name ? ` · Grupo ${match.group_name}` : ''}
                    </span>
                    <span className="text-xs text-gray-400">{formatMatchDate(match.match_date)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-medium text-white text-sm">{match.home_team_name}</span>
                    <span className="text-xs text-gray-500 px-2">vs</span>
                    <span className="font-medium text-white text-sm text-right">{match.away_team_name}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
