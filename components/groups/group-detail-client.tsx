'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, Check, MoreVertical, ChevronRight, Crown, Trophy, Target, X, Lock } from 'lucide-react';
import type { Group, Match, LeaderboardEntry } from '@/types';
import { cn, formatMatchDate, getRankEmoji } from '@/lib/utils';

interface ChampionPick {
  champion: string | null;
  runner_up: string | null;
  third_place: string | null;
}

interface GroupDetailClientProps {
  group: Group;
  leaderboard: LeaderboardEntry[];
  upcomingMatches: Match[];
  userId: string;
  memberCount: number;
  championPicks: Record<string, ChampionPick>;
  myPodio: ChampionPick | null;
}

export function GroupDetailClient({
  group,
  leaderboard,
  upcomingMatches,
  userId,
  memberCount,
  championPicks,
  myPodio,
}: GroupDetailClientProps) {
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'leaderboard' | 'matches'>('leaderboard');
  const [showMenu, setShowMenu] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const isCreator = group.created_by === userId;

  async function copyInviteLink() {
    await navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function deleteGroup() {
    setDeleting(true);
    const res = await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/groups');
      router.refresh();
    }
    setDeleting(false);
  }

  async function handleRemoveMember(targetUserId: string) {
    setRemovingUserId(targetUserId);
    await fetch(`/api/groups/${group.id}/members/${targetUserId}`, { method: 'DELETE' });
    setRemovingUserId(null);
    router.refresh();
  }

  const myEntry = leaderboard.find((e) => e.user_id === userId);
  const myRank = leaderboard.findIndex((e) => e.user_id === userId) + 1;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-white/10 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{group.name}</h1>
            {group.description && (
              <p className="text-gray-400 text-sm mt-1">{group.description}</p>
            )}
          </div>
          {isCreator && (
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="p-2 text-gray-500 hover:text-white transition-colors"
              >
                <MoreVertical size={18} />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-surface-card border border-white/10 rounded-xl shadow-xl w-52 py-1 overflow-hidden">
                    <button
                      onClick={() => { setShowInvite((v) => !v); setShowMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                    >
                      Código de invitación
                    </button>
                    <button
                      onClick={() => { setShowRemoveModal(true); setShowMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                    >
                      Eliminar miembro del grupo
                    </button>
                    <div className="border-t border-white/10 mt-1 pt-1">
                      <button
                        onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors"
                      >
                        Eliminar grupo
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {showInvite && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Código de invitación</p>
                <p className="text-lg font-mono font-black text-crown tracking-widest">{group.invite_code}</p>
              </div>
              <button
                onClick={copyInviteLink}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  copied ? 'bg-field/20 text-field-light' : 'bg-crown/20 text-crown hover:bg-crown/30'
                )}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? '¡Copiado!' : 'Copiar código'}
              </button>
            </div>
          </div>
        )}

        {myEntry && (
          <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xl font-black text-crown">{myEntry.total_points}</div>
              <div className="text-xs text-gray-500">Mis puntos</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-white">{myRank}º</div>
              <div className="text-xs text-gray-500">Posición</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-field-light">{memberCount}</div>
              <div className="text-xs text-gray-500">Miembros</div>
            </div>
          </div>
        )}
      </div>

      {/* My podio — read only */}
      <div className="bg-surface-card border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Crown size={14} className="text-crown" />
            Mi podio en este grupo
          </h3>
          <span className="flex items-center gap-1 text-[10px] text-gray-600">
            <Lock size={10} />
            Definitivo
          </span>
        </div>

        {myPodio?.champion ? (
          <div className="flex gap-2">
            {[
              { medal: '🥇', value: myPodio.champion, pts: 20 },
              { medal: '🥈', value: myPodio.runner_up, pts: 10 },
              { medal: '🥉', value: myPodio.third_place, pts: 5 },
            ].map(({ medal, value, pts }) => (
              <div key={medal} className="flex-1 bg-white/5 rounded-xl p-2.5 text-center">
                <div className="text-lg">{medal}</div>
                <div className="text-xs font-semibold text-white mt-1 leading-tight">{value || '–'}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">+{pts} pts</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-2">No elegiste podio al unirte</p>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 animate-slide-up">
          <p className="text-white font-semibold mb-1">¿Eliminar grupo?</p>
          <p className="text-gray-400 text-sm mb-4">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={deleteGroup}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      )}

      {showRemoveModal && (
        <div className="bg-surface-card border border-white/10 rounded-2xl p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Eliminar miembro</h3>
            <button onClick={() => setShowRemoveModal(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
              <X size={18} />
            </button>
          </div>
          {leaderboard.filter((e) => e.user_id !== userId).length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-2">No hay otros miembros</p>
          ) : (
            <div className="space-y-2">
              {leaderboard
                .filter((e) => e.user_id !== userId)
                .map((entry) => (
                  <div key={entry.user_id} className="flex items-center justify-between bg-surface rounded-xl px-4 py-3">
                    <span className="text-sm text-white">{entry.username}</span>
                    <button
                      onClick={() => handleRemoveMember(entry.user_id)}
                      disabled={removingUserId === entry.user_id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                    >
                      {removingUserId === entry.user_id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-surface-card border border-white/10 rounded-xl p-1">
        <button
          onClick={() => setTab('leaderboard')}
          className={cn(
            'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
            tab === 'leaderboard' ? 'bg-field text-white' : 'text-gray-400'
          )}
        >
          Clasificación
        </button>
        <button
          onClick={() => setTab('matches')}
          className={cn(
            'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
            tab === 'matches' ? 'bg-field text-white' : 'text-gray-400'
          )}
        >
          Partidos
        </button>
      </div>

      {/* Leaderboard */}
      {tab === 'leaderboard' && (
        <div className="bg-surface-card border border-white/10 rounded-2xl overflow-hidden">
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No hay clasificación todavía</div>
          ) : (
            leaderboard.map((entry, idx) => {
              const rank = idx + 1;
              const isMe = entry.user_id === userId;
              const picks = championPicks[entry.user_id];
              return (
                <div
                  key={entry.user_id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0',
                    isMe && 'bg-field/10'
                  )}
                >
                  <div className="w-8 text-center">
                    {rank <= 3 ? (
                      <span className="text-base">{getRankEmoji(rank)}</span>
                    ) : (
                      <span className="text-sm text-gray-500 font-medium">{rank}º</span>
                    )}
                  </div>

                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                      isMe ? 'bg-field text-white' : 'bg-surface-hover text-gray-300'
                    )}
                  >
                    {entry.username.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('font-semibold text-sm', isMe ? 'text-crown' : 'text-white')}>
                        {entry.username}
                      </span>
                      {isMe && <span className="text-[10px] text-crown">(tú)</span>}
                    </div>
                    {picks?.champion ? (
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-crown font-medium">🥇 {picks.champion}</span>
                        {picks.runner_up && <span className="text-[10px] text-gray-400">🥈 {picks.runner_up}</span>}
                        {picks.third_place && <span className="text-[10px] text-gray-500">🥉 {picks.third_place}</span>}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-600 mt-0.5">Sin predicción de podio</p>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Crown size={10} />
                        {entry.podio_points}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Trophy size={10} />
                        {entry.groups_points}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Target size={10} />
                        {entry.matches_points}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={cn('text-lg font-black', rank === 1 ? 'text-crown' : 'text-white')}>
                      {entry.total_points}
                    </div>
                    <div className="text-xs text-gray-500">pts</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Upcoming matches */}
      {tab === 'matches' && (
        <div className="space-y-2">
          {upcomingMatches.length === 0 ? (
            <div className="bg-surface-card border border-white/10 rounded-2xl p-8 text-center text-gray-400 text-sm">
              No hay partidos próximos
            </div>
          ) : (
            upcomingMatches.map((match) => (
              <Link key={match.id} href={`/matches/${match.id}`}>
                <div className="bg-surface-card border border-white/10 rounded-2xl p-4 card-hover">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 bg-surface px-2 py-0.5 rounded">{match.stage}</span>
                    <span className="text-xs text-gray-400">{formatMatchDate(match.match_date)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">{match.home_team_name}</span>
                    <span className="text-xs text-gray-600 px-2">vs</span>
                    <span className="font-medium text-white text-sm text-right">{match.away_team_name}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
