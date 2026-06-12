'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, Circle, Search, X, Zap } from 'lucide-react';
import type { Match } from '@/types';
import { cn, formatMatchDate, isMatchLive, isMatchFinished } from '@/lib/utils';

const STAGE_ES: Record<string, string> = {
  'Round of 32': 'Dieciseisavos',
  'Round of 16': 'Octavos de Final',
  'Quarter-finals': 'Cuartos de Final',
  'Semi-finals': 'Semifinales',
  'Third Place': 'Tercer Puesto',
  'Final': 'Final',
};

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

  const upcoming = [
    ...matches.filter((m) => isMatchLive(m.status)),
    ...matches.filter((m) => m.status === 'NS').slice(0, 4),
  ];
  const finished = matches.filter((m) => isMatchFinished(m.status));
  const nonFinished = matches.filter((m) => !isMatchFinished(m.status));

  const availableGroups = useMemo(() => {
    const base = filter === 'all' ? nonFinished : finished;
    const groups = new Set<string>();
    base.forEach((m) => { if (m.group_name) groups.add(m.group_name); });
    return Array.from(groups).sort();
  }, [filter, nonFinished, finished]);

  const availableStages = useMemo(() => {
    const base = filter === 'all' ? nonFinished : finished;
    const stageOrder = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Third Place', 'Final'];
    const stages = new Set<string>();
    base.forEach((m) => { if (!m.group_name && m.stage !== 'Group Stage') stages.add(m.stage); });
    return stageOrder.filter((s) => stages.has(s));
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
      const matchesGroup = !selectedGroup || m.group_name === selectedGroup || m.stage === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [filter, nonFinished, finished, upcoming, searchQuery, selectedGroup]);

  const showSearchBar = filter === 'all' || filter === 'finished';
  const liveCount = matches.filter((m) => isMatchLive(m.status)).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Partidos</h1>
          <p className="text-xs text-gray-500 mt-0.5">Mundial 2026</p>
        </div>
        {liveCount > 0 && (
          <div className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-green-400">{liveCount} en vivo</span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex bg-white/5 rounded-2xl p-1 gap-1">
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
              'flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5',
              filter === key
                ? 'bg-field text-white shadow-md'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center',
                filter === key ? 'bg-white/20 text-white' : 'bg-white/8 text-gray-500'
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + group filter */}
      {showSearchBar && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar país..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-field/50 focus:bg-white/8 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {(availableGroups.length > 0 || availableStages.length > 0) && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedGroup(null)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                  !selectedGroup ? 'bg-field text-white' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200'
                )}
              >
                Todos
              </button>
              {availableGroups.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                    selectedGroup === g ? 'bg-field text-white' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200'
                  )}
                >
                  Grupo {g}
                </button>
              ))}
              {availableGroups.length > 0 && availableStages.length > 0 && (
                <div className="shrink-0 w-px bg-white/10 my-1" />
              )}
              {availableStages.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedGroup(selectedGroup === s ? null : s)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                    selectedGroup === s ? 'bg-field text-white' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200'
                  )}
                >
                  {STAGE_ES[s] ?? s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Matches list */}
      {filtered.length === 0 ? (
        <div className="bg-white/3 border border-white/8 rounded-2xl p-10 text-center">
          <p className="text-gray-500 text-sm">No hay partidos en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((match) => (
            <MatchCard key={match.id} match={match} prediction={predictionMap[match.id]} />
          ))}
        </div>
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
  const label = match.group_name ? `Grupo ${match.group_name}` : (STAGE_ES[match.stage] ?? match.stage);

  return (
    <Link href={`/matches/${match.id}`} className="block group">
      <div className={cn(
        'relative overflow-hidden rounded-2xl border transition-all duration-200',
        'group-hover:scale-[1.01] group-active:scale-[0.99]',
        live
          ? 'bg-gradient-to-br from-green-950/50 to-surface-card border-green-500/40 shadow-lg shadow-green-900/20'
          : done
          ? 'bg-surface-card border-white/8 opacity-80 hover:opacity-100'
          : 'bg-surface-card border-white/10 hover:border-white/20'
      )}>
        {/* Card header row */}
        <div className={cn(
          'flex items-center justify-between px-4 py-2.5 border-b',
          live ? 'border-green-500/20 bg-green-500/8' : 'border-white/5'
        )}>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
              live ? 'bg-green-500/20 text-green-400' : 'bg-field/15 text-field'
            )}>
              {label}
            </span>
            <span className="text-[11px] text-gray-500">{formatMatchDate(match.match_date)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {live && (
              <span className="flex items-center gap-1 text-[11px] font-black text-green-400 bg-green-400/15 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                EN VIVO
              </span>
            )}
            {done && (
              <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Final</span>
            )}
          </div>
        </div>

        {/* Teams + score */}
        <div className="flex items-center px-5 py-4 gap-2">
          {/* Home */}
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center p-1',
              'bg-white/5 border border-white/8'
            )}>
              {match.home_team_logo
                ? <Image src={match.home_team_logo} alt="" width={48} height={48} className="w-11 h-11 object-contain" />
                : <div className="w-10 h-10 rounded-lg bg-white/10" />
              }
            </div>
            <span className="text-xs font-bold text-white text-center leading-tight line-clamp-2 w-full">
              {match.home_team_name ?? '?'}
            </span>
          </div>

          {/* Score / VS */}
          <div className="flex flex-col items-center shrink-0 w-[72px]">
            {done || live ? (
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl',
                live ? 'bg-green-500/15 border border-green-500/20' : 'bg-white/8 border border-white/10'
              )}>
                <span className={cn('text-xl font-black tabular-nums', live ? 'text-green-300' : 'text-white')}>
                  {match.home_score ?? 0}
                </span>
                <span className={cn('text-base font-black', live ? 'text-green-600' : 'text-gray-600')}>–</span>
                <span className={cn('text-xl font-black tabular-nums', live ? 'text-green-300' : 'text-white')}>
                  {match.away_score ?? 0}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/4 border border-white/8">
                <Zap size={12} className="text-gray-600" />
                <span className="text-xs font-black text-gray-600">VS</span>
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center p-1',
              'bg-white/5 border border-white/8'
            )}>
              {match.away_team_logo
                ? <Image src={match.away_team_logo} alt="" width={48} height={48} className="w-11 h-11 object-contain" />
                : <div className="w-10 h-10 rounded-lg bg-white/10" />
              }
            </div>
            <span className="text-xs font-bold text-white text-center leading-tight line-clamp-2 w-full">
              {match.away_team_name ?? '?'}
            </span>
          </div>
        </div>

        {/* Prediction footer */}
        {hasPrediction ? (
          <div className="px-4 py-2.5 border-t border-field/20 bg-field/8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-field shrink-0" />
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
        ) : match.status === 'NS' && match.home_team_name && match.away_team_name ? (
          <div className="px-4 py-2.5 border-t border-amber-500/20 bg-amber-500/5 flex items-center gap-2">
            <Circle size={14} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-[10px] text-amber-500/60 uppercase tracking-wider font-bold">Sin predicción</p>
              <p className="text-xs text-amber-400/80 font-semibold">Toca para predecir antes del partido</p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-2">
            <Circle size={14} className="text-gray-700 shrink-0" />
            <p className="text-xs text-gray-600">No predijiste este partido</p>
          </div>
        )}
      </div>
    </Link>
  );
}
