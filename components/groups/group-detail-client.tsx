'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, Check, MoreVertical, ChevronRight, Crown, Trophy, Target, X, Search, ChevronLeft, Pencil } from 'lucide-react';
import type { Group, Match, LeaderboardEntry, Team } from '@/types';
import { cn, formatMatchDate, getRankEmoji, isTournamentLocked } from '@/lib/utils';

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
  teams: Team[];
}

const PODIO_STEPS = [
  { label: 'Campeón del Mundial', medal: '🥇', pts: 20, color: 'text-crown' },
  { label: 'Segundo clasificado', medal: '🥈', pts: 10, color: 'text-gray-300' },
  { label: 'Tercer clasificado', medal: '🥉', pts: 5, color: 'text-amber-600' },
];

const STEP_HINTS = [
  '¿Qué selección crees que ganará el Mundial 2026?',
  '¿Quién llegará a la final pero no ganará?',
  '¿Qué selección quedará en tercer lugar?',
];

export function GroupDetailClient({
  group,
  leaderboard,
  upcomingMatches,
  userId,
  memberCount,
  championPicks,
  myPodio,
  teams,
}: GroupDetailClientProps) {
  const router = useRouter();
  const locked = isTournamentLocked();

  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'leaderboard' | 'matches'>('leaderboard');
  const [showMenu, setShowMenu] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Podio edit modal
  const [showPodio, setShowPodio] = useState(false);
  const [podioStep, setPodioStep] = useState(0);
  const [podioSearch, setPodioSearch] = useState('');
  const [champion, setChampion] = useState(myPodio?.champion ?? '');
  const [runnerUp, setRunnerUp] = useState(myPodio?.runner_up ?? '');
  const [thirdPlace, setThirdPlace] = useState(myPodio?.third_place ?? '');
  const [savingPodio, setSavingPodio] = useState(false);
  const [podioError, setPodioError] = useState('');
  const [savedPodio, setSavedPodio] = useState(false);

  const isCreator = group.created_by === userId;
  const teamOptions = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  function getStepValue(step: number) {
    if (step === 0) return champion;
    if (step === 1) return runnerUp;
    return thirdPlace;
  }

  function setStepValue(step: number, val: string) {
    if (step === 0) setChampion(val);
    else if (step === 1) setRunnerUp(val);
    else setThirdPlace(val);
  }

  function openPodioEdit() {
    setChampion(myPodio?.champion ?? '');
    setRunnerUp(myPodio?.runner_up ?? '');
    setThirdPlace(myPodio?.third_place ?? '');
    setPodioStep(0);
    setPodioSearch('');
    setPodioError('');
    setSavedPodio(false);
    setShowPodio(true);
  }

  function handleTeamSelect(name: string) {
    setStepValue(podioStep, name);
    setPodioSearch('');
    if (podioStep < 2) {
      setTimeout(() => setPodioStep((s) => s + 1), 150);
    }
  }

  async function handleSavePodio() {
    setPodioError('');
    if (!champion || !runnerUp || !thirdPlace) {
      setPodioError('Completa los tres puestos');
      return;
    }
    setSavingPodio(true);
    const res = await fetch(`/api/groups/${group.id}/podio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ champion, runner_up: runnerUp, third_place: thirdPlace }),
    });
    setSavingPodio(false);
    if (!res.ok) {
      const data = await res.json();
      setPodioError(data.error);
      return;
    }
    setSavedPodio(true);
    setShowPodio(false);
    router.refresh();
  }

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

  const currentStep = PODIO_STEPS[podioStep];
  const currentValue = getStepValue(podioStep);
  const filteredTeams = teamOptions.filter(
    (t) =>
      t.name.toLowerCase().includes(podioSearch.toLowerCase()) &&
      t.name !== champion &&
      t.name !== runnerUp &&
      t.name !== thirdPlace
  );
  const allDone = champion && runnerUp && thirdPlace;

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

      {/* My podio picks card */}
      <div className="bg-surface-card border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Crown size={14} className="text-crown" />
            Mi podio en este grupo
          </h3>
          {!locked && (
            <button
              onClick={openPodioEdit}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            >
              <Pencil size={11} />
              {myPodio?.champion ? 'Editar' : 'Elegir'}
            </button>
          )}
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
          <div className="text-center py-3">
            <p className="text-sm text-gray-500">No has elegido tu podio para este grupo</p>
            {!locked && (
              <button
                onClick={openPodioEdit}
                className="mt-2 text-xs text-crown hover:text-crown-muted transition-colors font-medium"
              >
                Elegir ahora →
              </button>
            )}
          </div>
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

      {/* Podio edit modal */}
      {showPodio && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-white/10 rounded-2xl w-full max-w-md animate-slide-up overflow-hidden">

            <div className="px-6 pt-6 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Crown className="text-crown" size={20} />
                  Tu podio — {group.name}
                </h2>
                <button onClick={() => setShowPodio(false)} className="text-gray-500 hover:text-gray-300 transition-colors p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Puntos en juego</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {PODIO_STEPS.map((s, i) => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-lg py-2 px-1 transition-all',
                        i === podioStep ? 'bg-crown/15 border border-crown/30' : 'opacity-50'
                      )}
                    >
                      <div className="text-xl mb-0.5">{s.medal}</div>
                      <div className={cn('text-sm font-bold', s.color)}>+{s.pts} pts</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{s.label.split(' ')[0]}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-1.5 mt-4">
                {PODIO_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all',
                      i < podioStep ? 'bg-crown' : i === podioStep ? 'bg-crown/60' : 'bg-white/10'
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-1">
                {podioStep > 0 && (
                  <button
                    onClick={() => { setPodioStep((s) => s - 1); setPodioSearch(''); }}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                <p className="text-sm font-bold text-white">{currentStep.medal} {currentStep.label}</p>
                <span className={cn('text-xs font-bold ml-auto', currentStep.color)}>+{currentStep.pts} pts</span>
              </div>
              <p className="text-xs text-gray-500 mb-3 ml-5">{STEP_HINTS[podioStep]}</p>

              {currentValue && (
                <div className="bg-crown/10 border border-crown/30 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-crown" />
                    <span className="text-white font-semibold text-sm">{currentValue}</span>
                  </div>
                  <button
                    onClick={() => setStepValue(podioStep, '')}
                    className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                  >
                    Cambiar
                  </button>
                </div>
              )}

              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Busca un equipo..."
                  value={podioSearch}
                  onChange={(e) => setPodioSearch(e.target.value)}
                  className="w-full bg-surface border border-white/10 rounded-xl pl-9 pr-4 py-2.5
                    text-white placeholder-gray-600 focus:outline-none focus:border-field transition-colors text-sm"
                />
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
                {filteredTeams.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-4">Sin resultados</p>
                ) : (
                  filteredTeams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTeamSelect(t.name)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all',
                        currentValue === t.name
                          ? 'bg-crown/15 border border-crown/40 text-white font-medium'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      {t.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="px-6 pb-6">
              {podioError && <p className="text-red-400 text-sm mb-3">{podioError}</p>}

              {(champion || runnerUp || thirdPlace) && (
                <div className="flex gap-2 mb-3">
                  {PODIO_STEPS.map((s, i) => {
                    const val = i === 0 ? champion : i === 1 ? runnerUp : thirdPlace;
                    return (
                      <div key={i} className={cn(
                        'flex-1 rounded-lg px-2 py-1.5 text-center border',
                        val ? 'border-white/10 bg-white/5' : 'border-white/5 opacity-40'
                      )}>
                        <div className="text-sm">{s.medal}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">{val || '–'}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {allDone ? (
                <button
                  onClick={handleSavePodio}
                  disabled={savingPodio}
                  className="w-full py-3.5 rounded-xl bg-crown text-surface font-bold text-sm
                    disabled:opacity-50 hover:bg-crown-muted transition-colors"
                >
                  {savingPodio ? 'Guardando...' : 'Guardar predicciones'}
                </button>
              ) : (
                <button
                  onClick={() => setShowPodio(false)}
                  className="w-full py-2.5 text-gray-500 text-sm hover:text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
