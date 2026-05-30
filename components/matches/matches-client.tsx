'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Circle } from 'lucide-react';
import type { Match } from '@/types';
import { cn, formatMatchDate, getMatchStatusLabel, isMatchLive, isMatchFinished } from '@/lib/utils';


interface MatchesClientProps {
  matches: Match[];
  predictionMap: Record<string, {
    match_id: string;
    predicted_home_score: number;
    predicted_away_score: number;
    points_total: number;
    is_calculated: boolean;
  } | undefined>;
}

type FilterType = 'upcoming' | 'all' | 'finished';

export function MatchesClient({ matches, predictionMap }: MatchesClientProps) {
  const [filter, setFilter] = useState<FilterType>('upcoming');

  const upcoming = matches.filter((m) => m.status === 'NS');
  const finished = matches.filter((m) => isMatchFinished(m.status));

  const filtered = filter === 'upcoming' ? upcoming : filter === 'all' ? matches : finished;

  const groups = filtered.reduce((acc: Record<string, Match[]>, match) => {
    const key = match.group_name ? `Grupo ${match.group_name}` : match.stage;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {});

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Partidos</h1>

      {/* Filter tabs */}
      <div className="flex bg-surface-card border border-white/10 rounded-xl p-1 gap-1">
        {([
          ['upcoming', 'Próximos', upcoming.length],
          ['all', 'Todos', matches.length],
          ['finished', 'Finalizados', finished.length],
        ] as [FilterType, string, number][]).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5',
              filter === key ? 'bg-field text-white' : 'text-gray-400'
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                filter === key ? 'bg-white/20' : 'bg-white/10 text-gray-400'
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Matches grouped */}
      {Object.keys(groups).length === 0 ? (
        <div className="bg-surface-card border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm">No hay partidos en esta categoría</p>
        </div>
      ) : (
        Object.entries(groups).map(([groupLabel, groupMatches]) => (
          <div key={groupLabel}>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
              {groupLabel}
            </h2>
            <div className="space-y-2">
              {groupMatches.map((match) => {
                const prediction = predictionMap[match.id];
                const hasPrediction = !!prediction;
                const live = isMatchLive(match.status);
                const done = isMatchFinished(match.status);

                return (
                  <Link key={match.id} href={`/matches/${match.id}`}>
                    <div className={cn(
                      'bg-surface-card border rounded-2xl p-4 card-hover',
                      live ? 'border-green-500/40' : 'border-white/10'
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {live && (
                            <span className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                              EN VIVO
                            </span>
                          )}
                          {!live && (
                            <span className="text-xs text-gray-500 bg-surface px-2 py-0.5 rounded">
                              {match.stage}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{formatMatchDate(match.match_date)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {match.home_team_logo && (
                            <img src={match.home_team_logo} alt="" className="w-6 h-6 object-contain shrink-0" />
                          )}
                          <span className="font-medium text-white text-sm truncate">{match.home_team_name}</span>
                        </div>

                        <div className="flex items-center gap-2 mx-3 shrink-0">
                          {done || live ? (
                            <span className="text-lg font-black text-white">
                              {match.home_score ?? 0} - {match.away_score ?? 0}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-600 font-medium">vs</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="font-medium text-white text-sm truncate text-right">{match.away_team_name}</span>
                          {match.away_team_logo && (
                            <img src={match.away_team_logo} alt="" className="w-6 h-6 object-contain shrink-0" />
                          )}
                        </div>
                      </div>

                      {/* Prediction info */}
                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                        {hasPrediction ? (
                          <>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <CheckCircle size={12} className="text-field-light" />
                              Tu predicción: {prediction!.predicted_home_score} - {prediction!.predicted_away_score}
                            </div>
                            {prediction!.is_calculated && (
                              <span className={cn(
                                'text-xs font-bold px-2 py-0.5 rounded',
                                prediction!.points_total > 0 ? 'bg-crown/20 text-crown' : 'bg-white/5 text-gray-500'
                              )}>
                                +{prediction!.points_total} pts
                              </span>
                            )}
                          </>
                        ) : match.status === 'NS' ? (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Circle size={12} />
                            Sin predicción
                          </div>
                        ) : (
                          <div className="text-xs text-gray-600">No hubo predicción</div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
