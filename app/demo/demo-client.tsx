'use client';

import { useState } from 'react';
import Link from 'next/link';
import { VarkingsLogo, VarkingsWordmark } from '@/components/ui/varkings-logo';
import { LevelBadge } from '@/components/ui/level-badge';
import { TournamentEndedBanner } from '@/components/ui/tournament-ended-banner';
import { cn } from '@/lib/utils';
import { getLevelProgress } from '@/lib/xp';

// Datos de ejemplo — no provienen de ningún usuario real ni de resultados reales del torneo.
const DEMO_MATCHES = [
  { home: 'España', away: 'Brasil', homeScore: 2, awayScore: 1, predHome: 2, predAway: 1, points: 15, stage: 'Cuartos de final' },
  { home: 'Argentina', away: 'Francia', homeScore: 1, awayScore: 1, predHome: 2, predAway: 0, points: 0, stage: 'Semifinal' },
  { home: 'Inglaterra', away: 'Alemania', homeScore: 0, awayScore: 2, predHome: 1, predAway: 2, points: 10, stage: 'Octavos de final' },
  { home: 'Portugal', away: 'Países Bajos', homeScore: 3, awayScore: 2, predHome: 3, predAway: 2, points: 15, stage: 'Fase de grupos' },
];

const DEMO_LEADERBOARD = [
  { rank: 1, username: 'carlos_vk', points: 284, level: 14 },
  { rank: 2, username: 'tú (demo)', points: 271, level: 13, isMe: true },
  { rank: 3, username: 'martagol', points: 255, level: 12 },
  { rank: 4, username: 'raul_pred', points: 230, level: 11 },
  { rank: 5, username: 'laura90', points: 198, level: 9 },
  { rank: 6, username: 'pablito_k', points: 165, level: 8 },
];

const DEMO_ACHIEVEMENTS = [
  { icon: '🎯', label: 'Resultado exacto', done: true },
  { icon: '🔥', label: '5 aciertos seguidos', done: true },
  { icon: '👑', label: 'Podio perfecto', done: false },
  { icon: '📅', label: 'Jugador constante', done: true },
];

const TABS = ['dashboard', 'partidos', 'clasificacion', 'perfil'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Inicio',
  partidos: 'Partidos',
  clasificacion: 'Clasificación',
  perfil: 'Perfil',
};

function DemoNotice() {
  return (
    <div className="bg-field/10 border border-field/30 rounded-xl px-4 py-3 text-xs text-gray-300">
      Estás viendo una demo con datos de ejemplo. Las acciones (predecir, chatear, crear grupos) están desactivadas.
    </div>
  );
}

export function DemoClient() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const demoProgress = getLevelProgress(1850);

  return (
    <div className="min-h-screen bg-surface pb-20">
      <header className="sticky top-0 z-50 bg-surface-card/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-4 h-16 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <VarkingsLogo size={32} />
            <VarkingsWordmark className="text-xl" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-crown/20 text-crown border border-crown/30 rounded-full px-2.5 py-1">
            Demo
          </span>
        </div>
      </header>

      <TournamentEndedBanner />

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <DemoNotice />

        <nav className="flex gap-1 bg-surface-card border border-white/10 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 text-xs font-semibold py-2 rounded-lg transition-colors',
                tab === t ? 'bg-field text-white' : 'text-gray-400 hover:text-gray-200'
              )}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>

        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="bg-surface-card border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white">Peña Mundial 2026</h2>
                <span className="text-xs text-gray-400">6 miembros</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">Grupo de ejemplo — quiniela entre amigos para todo el torneo.</p>
              <div className="space-y-2">
                {DEMO_LEADERBOARD.slice(0, 3).map((e) => (
                  <div key={e.rank} className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm">{e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}</span>
                    <span className={cn('flex-1 text-sm font-medium', e.isMe ? 'text-crown' : 'text-white')}>{e.username}</span>
                    <span className="text-sm font-bold text-white">{e.points} pts</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-card border border-white/10 rounded-2xl p-5">
              <h3 className="font-semibold text-white text-sm mb-2">Próximo partido</h3>
              <p className="text-xs text-gray-400">Todos los partidos del torneo ya se jugaron — revisa la pestaña Partidos para ver el histórico de predicciones.</p>
            </div>
          </div>
        )}

        {tab === 'partidos' && (
          <div className="space-y-3">
            {DEMO_MATCHES.map((m, i) => (
              <div key={i} className="bg-surface-card border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-wide text-gray-500">{m.stage}</span>
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', m.points > 0 ? 'bg-field/20 text-field-light' : 'bg-white/5 text-gray-500')}>
                    +{m.points} pts
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{m.home}</span>
                  <span className="text-lg font-black text-white">{m.homeScore} - {m.awayScore}</span>
                  <span className="text-sm font-medium text-white">{m.away}</span>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  Tu predicción: {m.predHome} - {m.predAway}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'clasificacion' && (
          <div className="bg-surface-card border border-white/10 rounded-2xl overflow-hidden">
            {DEMO_LEADERBOARD.map((e) => (
              <div
                key={e.rank}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0',
                  e.isMe && 'bg-field/10'
                )}
              >
                <div className="w-8 text-center shrink-0">
                  {e.rank <= 3 ? (
                    <span className="text-base">{e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}</span>
                  ) : (
                    <span className="text-sm text-gray-500 font-medium">{e.rank}º</span>
                  )}
                </div>
                <div className="w-9 h-9 rounded-full shrink-0 bg-surface-hover flex items-center justify-center text-sm font-bold text-gray-300">
                  {e.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span className={cn('font-semibold text-sm', e.isMe ? 'text-crown' : 'text-white')}>{e.username}</span>
                  {e.isMe && <span className="text-[10px] text-crown">(tú)</span>}
                  <LevelBadge level={e.level} size="xs" />
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black text-white">{e.points}</div>
                  <div className="text-xs text-gray-500">pts</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'perfil' && (
          <div className="space-y-4">
            <div className="bg-surface-card border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full bg-field flex items-center justify-center text-lg font-bold text-white">DE</div>
                <div>
                  <p className="font-bold text-white">tú (demo)</p>
                  <LevelBadge level={demoProgress.level} />
                </div>
              </div>
              <div className="h-2 bg-surface-hover rounded-full overflow-hidden mb-1">
                <div className="h-full bg-crown rounded-full" style={{ width: `${demoProgress.percent}%` }} />
              </div>
              <p className="text-xs text-gray-500">{demoProgress.xpInLevel} / {demoProgress.xpNeeded} XP para el siguiente nivel</p>
            </div>

            <div className="bg-surface-card border border-white/10 rounded-2xl p-5">
              <h3 className="font-semibold text-white text-sm mb-3">Logros</h3>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACHIEVEMENTS.map((a) => (
                  <div key={a.label} className={cn('rounded-xl p-3 text-center border', a.done ? 'bg-crown/10 border-crown/30' : 'bg-white/5 border-white/10 opacity-50')}>
                    <div className="text-xl mb-1">{a.icon}</div>
                    <div className="text-[11px] text-gray-300">{a.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="text-center pt-4">
          <Link href="/register" className="text-sm text-crown hover:text-crown-light transition-colors font-medium">
            Crear cuenta real →
          </Link>
        </div>
      </main>
    </div>
  );
}
