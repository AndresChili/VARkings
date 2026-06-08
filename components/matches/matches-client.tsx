'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, Circle, Search, X } from 'lucide-react';
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

export function MatchesClient({ matches: initialMatches, predictionMap }: MatchesClientProps) {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const hasLive = matches.some((m) => isMatchLive(m.status));
  const hasRecentlyStarted = matches.some(
    (m) => m.status === 'NS' && new Date(m.match_date) <= new Date()
  );
  const shouldPoll = hasLive || hasRecentlyStarted;

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!shouldPoll) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    async function refresh() {
      try {
        const res = await fetch('/api/matches');
        if (!res.ok) return;
        const fresh: Match[] = await res.json();
        setMatches(fresh);
      } catch {}
    }

    pollRef.current = setInterval(refresh, 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [shouldPoll]);

  const upcoming = matches.filter((m) => m.status === 'NS').slice(0, 4);
  const finished = matches.filter((m) => isMatchFinished(m.status));
  const nonFinished = matches.filter((m) => !isMatchFinished(m.status));

  const availableGroups = useMemo(() => {
    const base = filter === 'all' ? nonFinished : finished;
    const groups = new Set<string>();
    base.forEach((m) => {
      if (m.group_name) groups.add(m.group_name);
    });
    return Array.from(groups).sort();
  }, [filter, nonFinished, finished]);

  const filtered = useMemo(() => {
    if (filter === 'upcoming') return upcoming;

    const base = filter === 'all' ? nonFinished : finished;
    const sorted = [...base].sort((a, b) =>
      new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
    );

    const q = searchQuery.toLowerCase().trim();

    return sorted.filter((m) => {
      const matchesSearch = !q ||
        (m.home_team_name ?? '').toLowerCase().includes(q) ||
        (m.away_team_name ?? '').toLowerCase().includes(q);
      const matchesGroup = !selectedGroup || m.group_name === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [filter, nonFinished, finished, upcoming, searchQuery, selectedGroup]);

  const groups = useMemo(() => {
    if (filter !== 'upcoming') return null;
    return filtered.reduce((acc: Record<string, Match[]>, match) => {
      const key = match.group_name ? `Grupo ${match.group_name}` : match.stage;
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    }, {});
  }, [filter, filtered]);

  const showSearchBar = filter === 'all' || filter === 'finished';

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Partidos</h1>

      {/* Filter tabs */}
      <div className="flex bg-surface-card border border-white/10 rounded-xl p-1 gap-1">
        {([
          ['upcoming', 'Próximos', upcoming.length],
          ['all', 'Todos', nonFinished.length],
          ['finished', 'Finalizados', finished.length],
        ] as [FilterType, string, number][]).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => {
              setFilter(key);
              setSearchQuery('');
              setSelectedGroup(null);
            }}
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

      {/* Search + group filter (Todos / Finalizados only) */}
      {showSearchBar && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar país..."
              className="w-full bg-surface-card border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/25 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {availableGroups.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedGroup(null)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  !selectedGroup ? 'bg-field text-white' : 'bg-surface-card border border-white/10 text-gray-400'
                )}
              >
                Todos
              </button>
              {availableGroups.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    selectedGroup === g ? 'bg-field text-white' : 'bg-surface-card border border-white/10 text-gray-400'
                  )}
                >
                  Grupo {g}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Matches list */}
      {filter === 'upcoming' && groups ? (
        Object.keys(groups).length === 0 ? (
          <div className="bg-surface-card border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-gray-400 text-sm">No hay partidos en esta categoría</p>
          </div>
        ) : (
          Object.entries(groups).map(([groupLabel, groupMatches]) => (
            <div key={groupLabel} className="space-y-1">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
                {groupLabel}
              </h2>
              <div className="space-y-3">
                {groupMatches.map((match) => (
                  <MatchCard key={match.id} match={match} prediction={predictionMap[match.id]} />
                ))}
              </div>
            </div>
          ))
        )
      ) : (
        filtered.length === 0 ? (
          <div className="bg-surface-card border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-gray-400 text-sm">No hay partidos que coincidan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((match) => (
              <MatchCard key={match.id} match={match} prediction={predictionMap[match.id]} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function MatchCard({ match, prediction }: {
  match: Match;
  prediction: { match_id: string; predicted_home_score: number; predicted_away_score: number; points_total: number; is_calculated: boolean } | undefined;
}) {
  const hasPrediction = !!prediction;
  const live = isMatchLive(match.status);
  const done = isMatchFinished(match.status);

  return (
    <Link href={`/matches/${match.id}`} className="block">
      <div className={cn(
        'bg-surface-card border rounded-2xl overflow-hidden card-hover',
        live ? 'border-green-500/40' : 'border-white/10'
      )}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-sm font-semibold text-white/80">{formatMatchDate(match.match_date)}</span>
          {live && (
            <span className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              EN VIVO
            </span>
          )}
        </div>

        <div className="flex items-center justify-between px-4 pb-4 gap-2">
          <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            {match.home_team_logo
              ? <Image src={match.home_team_logo} alt="" width={40} height={40} className="w-10 h-10 object-contain" />
              : <div className="w-10 h-10 rounded-full bg-white/5" />
            }
            <span className="text-xs font-semibold text-white text-center leading-tight line-clamp-2">{match.home_team_name}</span>
          </div>

          <div className="flex flex-col items-center shrink-0 px-2">
            {done || live ? (
              <span className="text-2xl font-black text-white tabular-nums tracking-tight">
                {match.home_score ?? 0} – {match.away_score ?? 0}
              </span>
            ) : (
              <span className="text-xs font-bold text-gray-600 bg-white/5 px-3 py-1 rounded-lg">VS</span>
            )}
          </div>

          <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            {match.away_team_logo
              ? <Image src={match.away_team_logo} alt="" width={40} height={40} className="w-10 h-10 object-contain" />
              : <div className="w-10 h-10 rounded-full bg-white/5" />
            }
            <span className="text-xs font-semibold text-white text-center leading-tight line-clamp-2">{match.away_team_name}</span>
          </div>
        </div>

        {hasPrediction ? (
          <div className="px-4 py-3 border-t border-white/10 bg-field/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={15} className="text-green-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Tu predicción</p>
                <p className="text-sm font-black text-white">{prediction!.predicted_home_score} – {prediction!.predicted_away_score}</p>
              </div>
            </div>
            {prediction!.is_calculated && (
              <span className={cn(
                'text-sm font-black px-3 py-1 rounded-xl',
                prediction!.points_total > 0 ? 'bg-crown/20 text-crown' : 'bg-white/5 text-gray-500'
              )}>
                +{prediction!.points_total} pts
              </span>
            )}
          </div>
        ) : match.status === 'NS' ? (
          <div className="px-4 py-3 border-t border-amber-500/20 bg-amber-500/5 flex items-center gap-2">
            <Circle size={15} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-[10px] text-amber-500/70 uppercase tracking-wider font-bold">Sin predicción</p>
              <p className="text-xs text-amber-400 font-semibold">Toca para predecir antes del partido</p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 border-t border-white/5 bg-white/[0.02] flex items-center gap-2">
            <Circle size={15} className="text-gray-600 shrink-0" />
            <p className="text-xs text-gray-600">No predijiste este partido</p>
          </div>
        )}
      </div>
    </Link>
  );
}
