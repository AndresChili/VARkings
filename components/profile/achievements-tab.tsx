'use client';

import { CheckCircle } from 'lucide-react';
import { type AchievementStats, type Achievement, getAchievements } from '@/lib/achievements';

export type { AchievementStats, Achievement };
export { getAchievements };

const C = {
  predicciones: {
    bg:     'from-blue-500/30 via-cyan-500/20 to-blue-700/10',
    border: 'border-blue-500/35',
    icon:   'bg-blue-500/20',
    bar:    'from-blue-500 to-cyan-400',
    badge:  'bg-blue-500/20 text-blue-200 border-blue-400/30',
  },
  social: {
    bg:     'from-pink-500/30 via-rose-500/20 to-pink-700/10',
    border: 'border-pink-500/35',
    icon:   'bg-pink-500/20',
    bar:    'from-pink-500 to-rose-400',
    badge:  'bg-pink-500/20 text-pink-200 border-pink-400/30',
  },
  grupos: {
    bg:     'from-field/40 via-field-dark/25 to-field/10',
    border: 'border-field/40',
    icon:   'bg-field/25',
    bar:    'from-field to-field-light',
    badge:  'bg-field/25 text-field-light border-field/35',
  },
  puntos: {
    bg:     'from-amber-500/30 via-yellow-500/20 to-amber-700/10',
    border: 'border-amber-500/35',
    icon:   'bg-amber-500/20',
    bar:    'from-amber-500 to-yellow-400',
    badge:  'bg-amber-500/20 text-amber-200 border-amber-400/30',
  },
  perfil: {
    bg:     'from-purple-500/30 via-violet-500/20 to-purple-700/10',
    border: 'border-purple-500/35',
    icon:   'bg-purple-500/20',
    bar:    'from-purple-500 to-violet-400',
    badge:  'bg-purple-500/20 text-purple-200 border-purple-400/30',
  },
  rachas: {
    bg:     'from-orange-500/30 via-red-500/20 to-orange-700/10',
    border: 'border-orange-500/35',
    icon:   'bg-orange-500/20',
    bar:    'from-orange-500 to-red-400',
    badge:  'bg-orange-500/20 text-orange-200 border-orange-400/30',
  },
} as const;

function AchievementCard({ a, done = false }: { a: Achievement; done?: boolean }) {
  const pct  = Math.min(100, Math.round((a.current / a.target) * 100));
  const c    = C[a.category];

  if (done) {
    return (
      <div className={`relative bg-gradient-to-br ${c.bg} border ${c.border} rounded-2xl p-4 overflow-hidden`}>
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl ${c.icon} flex items-center justify-center text-[1.75rem] shrink-0 shadow-inner`}>
            {a.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <p className="font-bold text-white text-sm leading-snug">{a.title}</p>
              <CheckCircle size={17} className="text-white/75 shrink-0 mt-0.5" />
            </div>
            <p className="text-xs text-white/55 leading-snug">{a.description}</p>
            <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.badge}`}>
              ✓ Conseguido
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-white/8 rounded-2xl p-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-[1.75rem] shrink-0 grayscale opacity-35">
          {a.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <p className="font-semibold text-gray-500 text-sm leading-snug">{a.title}</p>
            <span className="text-xs text-gray-600 tabular-nums shrink-0 mt-0.5">{a.current}/{a.target}</span>
          </div>
          <p className="text-xs text-gray-600 mb-2.5 leading-snug">{a.description}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${c.bar} rounded-full transition-all duration-700 opacity-65`}
                style={{ width: `${pct > 0 ? Math.max(pct, 4) : 0}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 tabular-nums w-8 text-right">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AchievementsTab({ stats, earnedIds = [] }: { stats: AchievementStats; earnedIds?: string[] }) {
  const achievements = getAchievements(stats);
  const earnedSet    = new Set(earnedIds);
  const isDone       = (a: Achievement) => a.current >= a.target || earnedSet.has(a.id);
  const done         = achievements.filter(isDone);
  const pending      = achievements.filter((a) => !isDone(a));
  const overallPct   = Math.round((done.length / achievements.length) * 100);

  return (
    <div className="space-y-3 pb-6">
      {/* Streak banner */}
      <div className="bg-gradient-to-br from-orange-500/25 via-red-500/15 to-orange-700/10 border border-orange-500/30 rounded-2xl px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/20 flex items-center justify-center text-xl">
            🔥
          </div>
          <div>
            <p className="text-sm font-bold text-white">Racha actual</p>
            <p className="text-xs text-white/50">{stats.totalDaysActive} días jugados en total</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-orange-300 tabular-nums">{stats.currentStreak}</p>
          <p className="text-xs text-white/40">días seguidos</p>
        </div>
      </div>

      {/* Overall progress card */}
      <div className="bg-surface-card border border-white/8 rounded-2xl px-4 py-3.5 flex items-center justify-between">
        <div>
          <p className="text-base font-black text-white tabular-nums">
            {done.length} <span className="text-gray-500 font-normal text-sm">de {achievements.length}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">logros conseguidos</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-crown tabular-nums">{overallPct}%</p>
          <div className="h-1.5 w-28 bg-white/5 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-gradient-to-r from-crown-dark to-crown-light rounded-full transition-all duration-700"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-1">Conseguidos ✨</p>
          {done.map((a) => <AchievementCard key={a.id} a={a} done={true} />)}
        </div>
      )}

      {/* In progress */}
      {pending.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-1">En progreso 🔒</p>
          {pending.map((a) => <AchievementCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}
