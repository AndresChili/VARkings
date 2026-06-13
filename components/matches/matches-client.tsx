'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, Circle, Search, X, ChevronRight } from 'lucide-react';
import type { Match } from '@/types';
import { cn, isMatchLive, isMatchFinished } from '@/lib/utils';

const STAGE_ES: Record<string, string> = {
  'Round of 32': 'Dieciseisavos',
  'Round of 16': 'Octavos de Final',
  'Quarter-finals': 'Cuartos de Final',
  'Semi-finals': 'Semifinales',
  'Third Place': 'Tercer Puesto',
  'Final': 'Final',
};

function formatCardDate(dateString: string) {
  const d = new Date(dateString);
  const day = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return { day: day.replace('.', ''), time };
}

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
  const [filter, setFilter] = useState<FilterType>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('matches-filter') as FilterType) ?? 'upcoming';
    }
    return 'upcoming';
  });
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
        setMatches(await res.json());
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
  const liveCount = matches.filter((m) => isMatchLive(m.status)).length;

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

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold text-field-light uppercase tracking-widest mb-1">Mundial 2026</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Partidos</h1>
        </div>
        {liveCount > 0 && (
          <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/40 px-3 py-1.5 rounded-full mb-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs font-black text-green-300">{liveCount} en vivo</span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex bg-surface-hover/60 rounded-2xl p-1 gap-1 border border-white/6">
        {([
          ['upcoming', 'Próximos', upcoming.length],
          ['all', 'Todos', nonFinished.length],
          ['finished', 'Finalizados', finished.length],
        ] as [FilterType, string, number][]).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => { setFilter(key); sessionStorage.setItem('matches-filter', key); setSearchQuery(''); setSelectedGroup(null); }}
            className={cn(
              'flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5',
              filter === key
                ? 'bg-field text-white shadow-lg shadow-field/20'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-black',
                filter === key ? 'bg-white/25 text-white' : 'bg-white/8 text-gray-500'
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      {showSearchBar && (
        <div className="space-y-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar equipo..."
              className="w-full bg-surface-hover/50 border border-white/8 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-field/60 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X size={14} />
              </button>
            )}
          </div>
          {(availableGroups.length > 0 || availableStages.length > 0) && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedGroup(null)}
                className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  !selectedGroup ? 'bg-field text-white' : 'bg-white/5 border border-white/10 text-gray-400')}
              >Todos</button>
              {availableGroups.map((g) => (
                <button key={g} onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
                  className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    selectedGroup === g ? 'bg-field text-white' : 'bg-white/5 border border-white/10 text-gray-400')}>
                  Grupo {g}
                </button>
              ))}
              {availableGroups.length > 0 && availableStages.length > 0 && <div className="shrink-0 w-px bg-white/10 my-1" />}
              {availableStages.map((s) => (
                <button key={s} onClick={() => setSelectedGroup(selectedGroup === s ? null : s)}
                  className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    selectedGroup === s ? 'bg-field text-white' : 'bg-white/5 border border-white/10 text-gray-400')}>
                  {STAGE_ES[s] ?? s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/6 p-10 text-center">
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
  const { day, time } = formatCardDate(match.match_date);

  return (
    <Link href={`/matches/${match.id}`} className="block group">
      <div className={cn(
        'relative overflow-hidden rounded-2xl transition-all duration-200',
        'group-hover:scale-[1.015] group-active:scale-[0.98]',
        live
          ? 'shadow-xl shadow-green-900/40'
          : 'group-hover:shadow-lg group-hover:shadow-black/30'
      )}>
        {/* Card background */}
        <div className={cn(
          'absolute inset-0',
          live
            ? 'bg-gradient-to-br from-[#0d2e1a] via-[#112b1f] to-surface-card border border-green-500/30'
            : done
            ? 'bg-surface-card border border-white/6'
            : 'bg-gradient-to-b from-surface-hover to-surface-card border border-white/10 group-hover:border-white/16'
        )} />

        {/* Live glow top bar */}
        {live && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent" />
        )}

        <div className="relative">
          {/* Header: label + date/time */}
          <div className="flex items-center justify-between px-4 pt-3 pb-0">
            <span className={cn(
              'text-[10px] font-black uppercase tracking-[0.12em]',
              live ? 'text-green-400' : 'text-field-light/80'
            )}>
              {label}
            </span>
            <div className="flex items-center gap-2">
              {live ? (
                <span className="flex items-center gap-1.5 bg-green-500/25 border border-green-400/30 text-green-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  En vivo
                </span>
              ) : done ? (
                <span className="text-[11px] text-gray-600 font-semibold">{day}</span>
              ) : (
                <span className="text-[11px] text-gray-500 font-medium">{day}</span>
              )}
            </div>
          </div>

          {/* Time (only when not live) */}
          {!live && (
            <div className="flex justify-end px-4">
              <span className={cn(
                'text-xs font-bold tabular-nums',
                done ? 'text-gray-600' : 'text-white/60'
              )}>{time}</span>
            </div>
          )}

          {/* Teams + score */}
          <div className="flex items-center px-4 pt-2 pb-4 gap-2">
            {/* Home */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              {match.home_team_logo
                ? <Image src={match.home_team_logo} alt={match.home_team_name ?? ''} width={56} height={56}
                    className={cn('w-14 h-14 object-contain', live ? 'drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]' : 'drop-shadow-md')} />
                : <div className="w-14 h-14 rounded-full bg-white/6 flex items-center justify-center">
                    <span className="text-2xl opacity-30">?</span>
                  </div>
              }
              <span className="text-[11px] font-bold text-white/90 text-center leading-tight line-clamp-2 w-full px-1">
                {match.home_team_name ?? 'Por determinar'}
              </span>
            </div>

            {/* Score / VS */}
            <div className="shrink-0 w-[76px] flex flex-col items-center">
              {done || live ? (
                <div className={cn(
                  'flex items-center gap-1 px-3 py-2 rounded-2xl',
                  live
                    ? 'bg-green-500/20 border border-green-500/25'
                    : 'bg-white/8 border border-white/10'
                )}>
                  <span className={cn('text-2xl font-black tabular-nums leading-none', live ? 'text-green-300' : 'text-white')}>
                    {match.home_score ?? 0}
                  </span>
                  <span className={cn('text-base font-black leading-none', live ? 'text-green-600' : 'text-gray-600')}>-</span>
                  <span className={cn('text-2xl font-black tabular-nums leading-none', live ? 'text-green-300' : 'text-white')}>
                    {match.away_score ?? 0}
                  </span>
                </div>
              ) : (
                <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/8">
                  <span className="text-xs font-black text-gray-600 tracking-[0.15em]">VS</span>
                </div>
              )}
            </div>

            {/* Away */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              {match.away_team_logo
                ? <Image src={match.away_team_logo} alt={match.away_team_name ?? ''} width={56} height={56}
                    className={cn('w-14 h-14 object-contain', live ? 'drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]' : 'drop-shadow-md')} />
                : <div className="w-14 h-14 rounded-full bg-white/6 flex items-center justify-center">
                    <span className="text-2xl opacity-30">?</span>
                  </div>
              }
              <span className="text-[11px] font-bold text-white/90 text-center leading-tight line-clamp-2 w-full px-1">
                {match.away_team_name ?? 'Por determinar'}
              </span>
            </div>
          </div>

          {/* Prediction footer */}
          {hasPrediction ? (
            <div className={cn(
              'flex items-center justify-center gap-2.5 px-4 py-3 border-t',
              live ? 'border-green-500/15 bg-green-500/8' : 'border-white/6 bg-field/8'
            )}>
              <CheckCircle size={13} className="text-field-light shrink-0" />
              <span className="text-xs text-gray-400 font-medium">Tu predicción:</span>
              <span className="text-sm font-black text-white tabular-nums">
                {prediction!.predicted_home_score} – {prediction!.predicted_away_score}
              </span>
              {prediction!.is_calculated && (
                <span className={cn(
                  'text-xs font-black px-2.5 py-1 rounded-lg',
                  prediction!.points_total > 0
                    ? 'bg-crown/25 text-crown-light border border-crown/20'
                    : 'bg-white/5 text-gray-500'
                )}>
                  {prediction!.points_total > 0 ? `+${prediction!.points_total} pts` : '0 pts'}
                </span>
              )}
            </div>
          ) : match.status === 'NS' && match.home_team_name && match.away_team_name ? (
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-amber-500/20 bg-amber-500/5">
              <Circle size={13} className="text-amber-400 shrink-0" />
              <span className="text-xs text-amber-300/80 font-semibold">Predice antes del partido</span>
              <ChevronRight size={13} className="text-amber-400/60" />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/5">
              <Circle size={13} className="text-gray-700 shrink-0" />
              <p className="text-xs text-gray-600">No predijiste este partido</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
