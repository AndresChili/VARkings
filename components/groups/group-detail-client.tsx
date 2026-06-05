'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Copy, Check, MoreVertical, ChevronRight, ChevronDown, Crown, Trophy, Target, X, Lock, LogOut, UserCheck, UserX, Bell, Search, ChevronLeft, Layers } from 'lucide-react';
import type { Group, Match, LeaderboardEntry, Team } from '@/types';
import { cn, formatMatchDate, getRankEmoji, isTournamentLocked, WC_GROUPS, isMatchFinished, isMatchLive } from '@/lib/utils';
import { TEAM_NAME_ES } from '@/lib/teams';

interface ChampionPick {
  champion: string | null;
  runner_up: string | null;
  third_place: string | null;
}

interface PendingRequest {
  user_id: string;
  username: string;
  created_at: string;
}

interface MemberMatchPred {
  user_id: string;
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  points_total: number;
  is_calculated: boolean;
}

interface MatchWithMemberPreds extends Match {
  memberPredictions: MemberMatchPred[];
}

interface GroupDetailClientProps {
  group: Group;
  leaderboard: LeaderboardEntry[];
  matchesWithPredictions: MatchWithMemberPreds[];
  userId: string;
  memberCount: number;
  championPicks: Record<string, ChampionPick>;
  myPodio: ChampionPick | null;
  pendingRequests: PendingRequest[];
  teams: Team[];
  memberGroupPicks: Record<string, Record<string, string[]>>;
  groupQualifiers: Record<string, string[]>;
}

const PODIO_STEPS = [
  { key: 'champion' as const, label: 'Campeón del Mundial', medal: '🥇', pts: 20 },
  { key: 'runnerUp' as const, label: 'Segundo clasificado', medal: '🥈', pts: 10 },
  { key: 'thirdPlace' as const, label: 'Tercer clasificado', medal: '🥉', pts: 5 },
];


const STAGE_ES: Record<string, string> = {
  'Group Stage': 'Fase de Grupos',
  'Round of 16': 'Octavos de Final',
  'Quarter-finals': 'Cuartos de Final',
  'Semi-finals': 'Semifinales',
  '3rd Place Final': 'Tercer Puesto',
  'Final': 'Final',
};

function getStageLabel(stage: string | null, groupName: string | null): string {
  if (groupName) return `Grupo ${groupName}`;
  return STAGE_ES[stage ?? ''] ?? stage ?? '';
}

const RANK_STYLES = [
  { row: 'bg-gradient-to-r from-crown/10 to-transparent', points: 'text-crown' },
  { row: 'bg-gradient-to-r from-gray-400/10 to-transparent', points: 'text-gray-300' },
  { row: 'bg-gradient-to-r from-amber-700/10 to-transparent', points: 'text-amber-600' },
];

export function GroupDetailClient({
  group,
  leaderboard,
  matchesWithPredictions,
  userId,
  memberCount,
  championPicks,
  myPodio,
  pendingRequests: initialRequests,
  teams,
  memberGroupPicks,
  groupQualifiers,
}: GroupDetailClientProps) {
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [tab, setTab] = useState<'leaderboard' | 'grupos' | 'matches'>('leaderboard');
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>(initialRequests);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [localLeaderboard, setLocalLeaderboard] = useState(leaderboard);

  const [showPodio, setShowPodio] = useState(() => !myPodio?.champion && !isTournamentLocked());
  const [podioStep, setPodioStep] = useState(0);
  const [podioSearch, setPodioSearch] = useState('');
  const [champion, setChampion] = useState('');
  const [runnerUp, setRunnerUp] = useState('');
  const [thirdPlace, setThirdPlace] = useState('');
  const [savingPodio, setSavingPodio] = useState(false);
  const [podioError, setPodioError] = useState('');

  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(userId);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [matchFilter, setMatchFilter] = useState<'upcoming' | 'finished'>('upcoming');
  const [showGroups, setShowGroups] = useState(false);
  const [groupStep, setGroupStep] = useState(0);
  const [groupPicks, setGroupPicks] = useState<Record<string, string[]>>({});
  const [savingGroups, setSavingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState('');

  const locked = isTournamentLocked();
  const isCreator = group.created_by === userId;
  const needsPodioSetup = !myPodio?.champion && !locked;

  useEffect(() => {
    if (!isCreator) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`join-requests-${group.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'join_requests', filter: `group_id=eq.${group.id}` },
        async (payload) => {
          const req = payload.new as { user_id: string; created_at: string; status: string };
          if (req.status !== 'pending') return;
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username')
            .eq('id', req.user_id)
            .single();
          setPendingRequests((prev) => {
            if (prev.some((r) => r.user_id === req.user_id)) return prev;
            return [...prev, { user_id: req.user_id, username: profile?.username ?? 'Usuario', created_at: req.created_at }];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group.id, isCreator]);

  async function copyInviteCode() {
    await navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function deleteGroup() {
    setDeleting(true);
    const res = await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    }
    setDeleting(false);
  }

  async function leaveGroup() {
    setLeaving(true);
    const res = await fetch(`/api/groups/${group.id}/leave`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    }
    setLeaving(false);
  }

  async function handleRemoveMember(targetUserId: string) {
    setLocalLeaderboard((prev) => prev.filter((e) => e.user_id !== targetUserId));
    setShowRemoveModal(false);
    const res = await fetch(`/api/groups/${group.id}/members/${targetUserId}`, { method: 'DELETE' });
    if (!res.ok) {
      setLocalLeaderboard(leaderboard);
      router.refresh();
    }
  }

  async function handleRequest(targetUserId: string, action: 'accept' | 'reject') {
    setProcessingUserId(targetUserId);
    const res = await fetch(`/api/groups/${group.id}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: targetUserId, action }),
    });
    if (res.ok) {
      setPendingRequests((prev) => prev.filter((r) => r.user_id !== targetUserId));
      if (action === 'accept') router.refresh();
    }
    setProcessingUserId(null);
  }

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

  function openPodio() {
    setChampion(''); setRunnerUp(''); setThirdPlace('');
    setPodioStep(0); setPodioSearch(''); setPodioError('');
    setShowPodio(true);
  }

  function toggleGroupTeam(teamName: string) {
    const g = WC_GROUPS[groupStep];
    setGroupPicks((prev) => {
      const picks = prev[g] || [];
      if (picks.includes(teamName)) return { ...prev, [g]: picks.filter((t) => t !== teamName) };
      if (picks.length >= 2) return prev;
      return { ...prev, [g]: [...picks, teamName] };
    });
  }

  function handleTeamSelect(name: string) {
    setStepValue(podioStep, name);
    setPodioSearch('');
    if (podioStep < 2) setTimeout(() => setPodioStep((s) => s + 1), 150);
  }

  async function handleSavePodio() {
    setPodioError('');
    if (!champion || !runnerUp || !thirdPlace) { setPodioError('Completa los tres puestos'); return; }
    setSavingPodio(true);
    const res = await fetch(`/api/groups/${group.id}/podio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ champion, runner_up: runnerUp, third_place: thirdPlace }),
    });
    setSavingPodio(false);
    if (!res.ok) {
      const data = await res.json();
      setPodioError(data.error ?? 'Error al guardar');
      return;
    }
    setShowPodio(false);
    setGroupStep(0); setGroupPicks({}); setGroupsError('');
    setShowGroups(true);
  }

  async function handleSaveGroups() {
    setSavingGroups(true); setGroupsError('');
    const res = await fetch('/api/predictions/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_predictions: groupPicks }),
    });
    setSavingGroups(false);
    if (!res.ok) {
      const data = await res.json();
      setGroupsError(data.error);
      return;
    }
    setShowGroups(false);
    router.refresh();
  }

  const teamOptions = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const filteredTeams = teamOptions.filter(
    (t) =>
      t.name.toLowerCase().includes(podioSearch.toLowerCase()) &&
      t.name !== champion && t.name !== runnerUp && t.name !== thirdPlace
  );
  const currentStep = PODIO_STEPS[podioStep];
  const currentValue = getStepValue(podioStep);
  const allDone = champion && runnerUp && thirdPlace;

  const currentGroupLetter = WC_GROUPS[groupStep];
  const teamsInCurrentGroup = teams.filter((t) => t.group_name === currentGroupLetter);
  const currentGroupPicks = groupPicks[currentGroupLetter] || [];
  const isLastGroup = groupStep === WC_GROUPS.length - 1;
  const canProceedGroup = currentGroupPicks.length === 2;

  const myEntry = localLeaderboard.find((e) => e.user_id === userId);
  const myRank = localLeaderboard.findIndex((e) => e.user_id === userId) + 1;

  const gruposLeaderboard = [...localLeaderboard].sort((a, b) => (b.groups_points ?? 0) - (a.groups_points ?? 0));

  return (
    <>
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="relative bg-surface-card border border-white/10 rounded-2xl p-5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-field-dark/30 via-transparent to-crown/5 pointer-events-none" />
        <div className="relative flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{group.name}</h1>
            {group.description && (
              <p className="text-gray-400 text-sm mt-1">{group.description}</p>
            )}
          </div>
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
                    onClick={() => { setShowInviteCode((v) => !v); setShowMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <Copy size={14} />
                    Código de invitación
                  </button>
                  {isCreator ? (
                    <>
                      <div className="border-t border-white/10 mt-1 pt-1">
                        <button
                          onClick={() => { setShowRemoveModal(true); setShowMenu(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                        >
                          Eliminar miembro
                        </button>
                      </div>
                      <div className="border-t border-white/10 mt-1 pt-1">
                        <button
                          onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors"
                        >
                          Eliminar grupo
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="border-t border-white/10 mt-1 pt-1">
                      <button
                        onClick={() => { setShowLeaveConfirm(true); setShowMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <LogOut size={14} />
                        Salir del grupo
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {showInviteCode && (
          <div className="relative mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Código de invitación</p>
              <p className="text-lg font-mono font-black text-crown tracking-widest">{group.invite_code}</p>
            </div>
            <button
              onClick={copyInviteCode}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                copied ? 'bg-field/20 text-field-light' : 'bg-crown/20 text-crown hover:bg-crown/30'
              )}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        )}

        {myEntry && (
          <div className="relative mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-3">
            <div className="bg-crown/10 border border-crown/20 rounded-xl py-2.5 text-center">
              <div className="text-xl font-black text-crown">{myEntry.total_points}</div>
              <div className="text-xs text-gray-500">Mis puntos</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl py-2.5 text-center">
              <div className="text-xl font-black text-white">{myRank}º</div>
              <div className="text-xs text-gray-500">Posición</div>
            </div>
            <div className="bg-field/10 border border-field/20 rounded-xl py-2.5 text-center">
              <div className="text-xl font-black text-field-light">{memberCount}</div>
              <div className="text-xs text-gray-500">Miembros</div>
            </div>
          </div>
        )}
      </div>

      {/* Pending requests (creator only) */}
      {isCreator && pendingRequests.length > 0 && (
        <div className="bg-surface-card border border-crown/20 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Bell size={14} className="text-crown" />
            Solicitudes de unión
            <span className="bg-crown/20 text-crown text-xs px-1.5 py-0.5 rounded-full font-bold ml-1">
              {pendingRequests.length}
            </span>
          </h3>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div key={req.user_id} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
                <span className="text-sm text-white font-medium">{req.username}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequest(req.user_id, 'reject')}
                    disabled={processingUserId === req.user_id}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <UserX size={16} />
                  </button>
                  <button
                    onClick={() => handleRequest(req.user_id, 'accept')}
                    disabled={processingUserId === req.user_id}
                    className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                  >
                    <UserCheck size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My podio */}
      <div className={cn(
        'bg-surface-card border rounded-2xl p-4 overflow-hidden relative',
        needsPodioSetup ? 'border-crown/30' : 'border-white/10'
      )}>
        {needsPodioSetup && <div className="absolute inset-0 bg-gradient-to-r from-crown/5 to-transparent pointer-events-none" />}
        <div className="relative flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Crown size={14} className="text-crown" />
            Mi podio en este grupo
          </h3>
          {!needsPodioSetup && (
            <span className="flex items-center gap-1 text-[10px] text-gray-600">
              <Lock size={10} />
              Definitivo
            </span>
          )}
        </div>

        {myPodio?.champion ? (
          <div className="relative flex gap-2">
            {[
              { medal: '🥇', value: myPodio.champion, pts: 20, bg: 'bg-crown/10 border-crown/30' },
              { medal: '🥈', value: myPodio.runner_up, pts: 10, bg: 'bg-gray-400/10 border-gray-400/20' },
              { medal: '🥉', value: myPodio.third_place, pts: 5, bg: 'bg-amber-700/10 border-amber-700/20' },
            ].map(({ medal, value, pts, bg }) => (
              <div key={medal} className={cn('flex-1 border rounded-xl p-2.5 text-center', bg)}>
                <div className="text-lg">{medal}</div>
                <div className="text-xs font-semibold text-white mt-1 leading-tight">{value || '–'}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">+{pts} pts</div>
              </div>
            ))}
          </div>
        ) : needsPodioSetup ? (
          <button
            onClick={openPodio}
            className="relative w-full py-2.5 rounded-xl bg-crown/15 border border-crown/30 text-crown text-sm font-semibold hover:bg-crown/20 transition-colors"
          >
            Elegir mi podio
          </button>
        ) : (
          <p className="relative text-sm text-gray-500 text-center py-2">Predicciones cerradas</p>
        )}
      </div>

      {/* Confirms */}
      {showLeaveConfirm && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 animate-slide-up">
          <p className="text-white font-semibold mb-1">¿Salir del grupo?</p>
          <p className="text-gray-400 text-sm mb-4">Perderás tu acceso y posición en la clasificación.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm">Cancelar</button>
            <button onClick={leaveGroup} disabled={leaving} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50">
              {leaving ? 'Saliendo...' : 'Salir'}
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 animate-slide-up">
          <p className="text-white font-semibold mb-1">¿Eliminar grupo?</p>
          <p className="text-gray-400 text-sm mb-4">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm">Cancelar</button>
            <button onClick={deleteGroup} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50">
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
          {localLeaderboard.filter((e) => e.user_id !== userId).length === 0 ? (
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
      <div className="flex bg-surface-card border border-white/10 rounded-xl p-1 gap-1">
        <button
          onClick={() => setTab('leaderboard')}
          className={cn(
            'flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5',
            tab === 'leaderboard'
              ? 'bg-gradient-to-r from-field to-field-muted text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          )}
        >
          <Trophy size={12} />
          Clasificación
        </button>
        <button
          onClick={() => setTab('grupos')}
          className={cn(
            'flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5',
            tab === 'grupos'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          )}
        >
          <Layers size={12} />
          Grupos
        </button>
        <button
          onClick={() => setTab('matches')}
          className={cn(
            'flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5',
            tab === 'matches'
              ? 'bg-gradient-to-r from-crown-dark to-crown text-surface shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          )}
        >
          <Target size={12} />
          Partidos
        </button>
      </div>

      {/* Leaderboard */}
      {tab === 'leaderboard' && (
        <div className="bg-surface-card border border-white/10 rounded-2xl overflow-hidden">
          {localLeaderboard.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No hay clasificación todavía</div>
          ) : (
            localLeaderboard.map((entry, idx) => {
              const rank = idx + 1;
              const isMe = entry.user_id === userId;
              const picks = championPicks[entry.user_id];
              const rankStyle = rank <= 3 ? RANK_STYLES[rank - 1] : null;
              return (
                <div
                  key={entry.user_id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0',
                    rankStyle?.row,
                    isMe && !rankStyle && 'bg-field/10'
                  )}
                >
                  <div className="w-8 text-center">
                    {rank <= 3 ? (
                      <span className="text-base">{getRankEmoji(rank)}</span>
                    ) : (
                      <span className="text-sm text-gray-500 font-medium">{rank}º</span>
                    )}
                  </div>

                  <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden ring-2 ring-transparent" style={rank === 1 ? { '--tw-ring-color': 'rgba(212,175,55,0.4)' } as React.CSSProperties : {}}>
                    {entry.avatar_url ? (
                      <Image src={entry.avatar_url} alt={entry.username} width={36} height={36} className="w-full h-full object-cover" />
                    ) : (
                      <div className={cn('w-full h-full flex items-center justify-center text-sm font-bold', isMe ? 'bg-field text-white' : rank === 1 ? 'bg-crown/20 text-crown' : 'bg-surface-hover text-gray-300')}>
                        {entry.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('font-semibold text-sm', isMe ? 'text-crown' : rank === 1 ? 'text-crown' : 'text-white')}>
                        {entry.username}
                      </span>
                      {isMe && <span className="text-[10px] text-crown">(tú)</span>}
                      {isCreator && entry.user_id === userId && <span className="text-[10px] bg-crown/15 text-crown px-1.5 py-0.5 rounded">Admin</span>}
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
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Crown size={10} />{entry.podio_points}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Trophy size={10} />{entry.groups_points}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Target size={10} />{entry.matches_points}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={cn('text-lg font-black', rankStyle?.points ?? (isMe ? 'text-crown' : 'text-white'))}>
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

      {/* Grupos tab */}
      {tab === 'grupos' && (
        <div className="bg-surface-card border border-white/10 rounded-2xl overflow-hidden">
          {gruposLeaderboard.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No hay miembros todavía</div>
          ) : (
            gruposLeaderboard.map((entry, idx) => {
              const isMe = entry.user_id === userId;
              const isExpanded = expandedMemberId === entry.user_id;
              const picks = memberGroupPicks[entry.user_id];
              const pickedCount = picks ? Object.values(picks).filter((v) => v.length > 0).length : 0;
              const hasPicks = pickedCount > 0;

              return (
                <div key={entry.user_id} className={cn('border-b border-white/5 last:border-0', isExpanded && 'bg-white/3')}>
                  {/* Row header — tap to expand/collapse */}
                  <button
                    onClick={() => setExpandedMemberId(isExpanded ? null : entry.user_id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="w-6 text-center shrink-0">
                      {idx + 1 <= 3 ? (
                        <span className="text-sm">{getRankEmoji(idx + 1)}</span>
                      ) : (
                        <span className="text-xs text-gray-500 font-medium">{idx + 1}º</span>
                      )}
                    </div>

                    <div className={cn('w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold', isMe ? 'bg-field text-white' : 'bg-surface-hover text-gray-300')}>
                      {entry.username.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-sm font-semibold', isMe ? 'text-crown' : 'text-white')}>{entry.username}</span>
                        {isMe && <span className="text-[10px] text-crown">(tú)</span>}
                      </div>
                      {!hasPicks && (
                        <span className="text-xs text-gray-700">Sin predicciones</span>
                      )}
                    </div>

                    <span className={cn(
                      'text-xs font-bold shrink-0 mr-1',
                      entry.groups_points > 0 ? 'text-field-light' : 'text-gray-600'
                    )}>{entry.groups_points} pts</span>

                    <ChevronRight
                      size={16}
                      className={cn('text-gray-600 transition-transform shrink-0', isExpanded && 'rotate-90')}
                    />
                  </button>

                  {/* Expanded picks */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      {!hasPicks ? (
                        <p className="text-sm text-gray-600 text-center py-3">
                          {isMe ? 'Aún no has hecho tus predicciones de grupos' : `${entry.username} no ha hecho predicciones todavía`}
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {WC_GROUPS.map((g) => {
                            const teamPicks = picks?.[g] ?? [];
                            const qualifiers = groupQualifiers[g];
                            const hasResults = qualifiers && qualifiers.length > 0;
                            let correctCount = 0;
                            if (hasResults) {
                              correctCount = teamPicks.filter((t) => qualifiers.includes(t)).length;
                            }
                            const pointsEarned = correctCount * 2;
                            const cardBg = !hasResults || teamPicks.length === 0
                              ? 'bg-surface border-white/5'
                              : correctCount === 2
                              ? 'bg-green-500/10 border-green-500/30'
                              : correctCount === 1
                              ? 'bg-yellow-500/10 border-yellow-500/30'
                              : 'bg-red-500/10 border-red-500/30';
                            return (
                              <div key={g} className={cn('rounded-xl p-3 border', cardBg)}>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Grupo {g}</p>
                                  {hasResults && teamPicks.length > 0 && (
                                    <span className={cn(
                                      'text-[10px] font-bold',
                                      correctCount === 2 ? 'text-green-400' : correctCount === 1 ? 'text-yellow-400' : 'text-red-400'
                                    )}>+{pointsEarned}</span>
                                  )}
                                </div>
                                {teamPicks.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {teamPicks.map((name) => {
                                      const isCorrect = hasResults && qualifiers!.includes(name);
                                      const isWrong = hasResults && !qualifiers!.includes(name);
                                      return (
                                        <div key={name} className={cn(
                                          'flex items-center gap-1.5 rounded-lg px-2 py-1',
                                          isCorrect ? 'bg-green-500/15' : isWrong ? 'bg-red-500/10' : 'bg-white/5'
                                        )}>
                                          {isCorrect && <Check size={9} className="text-green-400 shrink-0" />}
                                          {isWrong && <X size={9} className="text-red-400 shrink-0" />}
                                          <span className={cn(
                                            'text-xs font-medium leading-tight truncate',
                                            isCorrect ? 'text-green-300' : isWrong ? 'text-red-400' : 'text-gray-300'
                                          )}>{name}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-700 mt-1">—</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Matches tab */}
      {tab === 'matches' && (() => {
        const finishedMatches = matchesWithPredictions.filter((m) => isMatchFinished(m.status));
        const upcomingMatchesList = matchesWithPredictions.filter((m) => !isMatchFinished(m.status));
        const liveMatches = matchesWithPredictions.filter((m) => isMatchLive(m.status));
        const displayed = matchFilter === 'finished' ? finishedMatches : upcomingMatchesList;

        return (
          <div className="space-y-3">
            {/* Filter pills */}
            <div className="flex bg-surface-card border border-white/10 rounded-xl p-1 gap-1">
              <button
                onClick={() => setMatchFilter('upcoming')}
                className={cn(
                  'flex-1 py-2 text-xs font-semibold rounded-lg transition-colors',
                  matchFilter === 'upcoming' ? 'bg-field text-white' : 'text-gray-400'
                )}
              >
                Próximos
                {upcomingMatchesList.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{upcomingMatchesList.length}</span>
                )}
              </button>
              <button
                onClick={() => setMatchFilter('finished')}
                className={cn(
                  'flex-1 py-2 text-xs font-semibold rounded-lg transition-colors',
                  matchFilter === 'finished' ? 'bg-field text-white' : 'text-gray-400'
                )}
              >
                Jugados
                {finishedMatches.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{finishedMatches.length}</span>
                )}
              </button>
            </div>

            {/* Live badge */}
            {liveMatches.length > 0 && matchFilter === 'upcoming' && (
              <div className="flex items-center gap-2 px-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-semibold">{liveMatches.length} partido{liveMatches.length > 1 ? 's' : ''} en vivo</span>
              </div>
            )}

            {displayed.length === 0 ? (
              <div className="bg-surface-card border border-white/10 rounded-2xl p-8 text-center text-gray-400 text-sm">
                {matchFilter === 'finished' ? 'Aún no se ha jugado ningún partido' : 'No hay partidos próximos'}
              </div>
            ) : (
              displayed.map((match) => {
                const isExpanded = expandedMatchId === match.id;
                const finished = isMatchFinished(match.status);
                const live = isMatchLive(match.status);
                const predsCount = match.memberPredictions.length;

                const homeName = TEAM_NAME_ES[match.home_team_name ?? ''] ?? match.home_team_name;
                const awayName = TEAM_NAME_ES[match.away_team_name ?? ''] ?? match.away_team_name;

                const stageLabel = getStageLabel(match.stage, match.group_name);

                return (
                  <div key={match.id} className={cn(
                    'border rounded-2xl overflow-hidden',
                    live
                      ? 'bg-green-950/30 border-green-500/30'
                      : finished
                      ? 'bg-surface-card border-white/10'
                      : 'bg-surface-card border-white/8'
                  )}>
                    <button
                      onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                      className="w-full text-left"
                    >
                      {/* Stage + fecha */}
                      <div className="flex items-center justify-between px-4 pt-3 pb-1">
                        <span className={cn(
                          'text-[11px] font-bold uppercase tracking-wider',
                          live ? 'text-green-400' : 'text-gray-600'
                        )}>
                          {live ? '🟢 EN VIVO · ' : ''}{stageLabel}
                        </span>
                        <span className="text-[11px] text-gray-500">{formatMatchDate(match.match_date)}</span>
                      </div>

                      {/* Equipos + marcador */}
                      <div className="flex items-center px-4 pt-2 pb-3 gap-3">
                        {/* Local */}
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {match.home_team_logo
                            ? <Image src={match.home_team_logo} alt="" width={36} height={36} className="w-9 h-9 object-contain shrink-0" unoptimized />
                            : <div className="w-9 h-9 rounded-full bg-white/8 shrink-0 flex items-center justify-center text-sm font-bold text-gray-500">{homeName?.slice(0,1)}</div>
                          }
                          <span className="text-sm font-semibold text-white leading-tight line-clamp-2">{homeName}</span>
                        </div>

                        {/* Marcador */}
                        <div className="shrink-0 flex flex-col items-center">
                          {finished || live ? (
                            <span className={cn(
                              'text-xl font-black tabular-nums tracking-tight px-1',
                              live ? 'text-green-300' : 'text-white'
                            )}>
                              {match.home_score ?? 0} – {match.away_score ?? 0}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-gray-600 bg-white/5 px-2.5 py-1 rounded-lg tracking-widest">VS</span>
                          )}
                        </div>

                        {/* Visitante */}
                        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-row-reverse">
                          {match.away_team_logo
                            ? <Image src={match.away_team_logo} alt="" width={36} height={36} className="w-9 h-9 object-contain shrink-0" unoptimized />
                            : <div className="w-9 h-9 rounded-full bg-white/8 shrink-0 flex items-center justify-center text-sm font-bold text-gray-500">{awayName?.slice(0,1)}</div>
                          }
                          <span className="text-sm font-semibold text-white leading-tight line-clamp-2 text-right">{awayName}</span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
                        <span className="text-[11px] text-gray-600">
                          {predsCount > 0
                            ? `${predsCount} predicci${predsCount === 1 ? 'ón' : 'ones'}`
                            : 'Sin predicciones aún'}
                        </span>
                        <ChevronDown
                          size={13}
                          className={cn('text-gray-600 transition-transform duration-200', isExpanded && 'rotate-180')}
                        />
                      </div>
                    </button>

                    {/* Expanded predictions */}
                    {isExpanded && (
                      <div className="border-t border-white/5 divide-y divide-white/5">
                        {localLeaderboard.map((entry) => {
                          const pred = match.memberPredictions.find((p) => p.user_id === entry.user_id);
                          const isMe = entry.user_id === userId;
                          return (
                            <div
                              key={entry.user_id}
                              className={cn(
                                'flex items-center gap-3 px-4 py-2.5',
                                isMe && 'bg-field/5'
                              )}
                            >
                              <div className={cn(
                                'w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold',
                                isMe ? 'bg-field text-white' : 'bg-surface-hover text-gray-400'
                              )}>
                                {entry.username.slice(0, 2).toUpperCase()}
                              </div>
                              <span className={cn('text-xs font-medium flex-1', isMe ? 'text-crown' : 'text-gray-300')}>
                                {entry.username}
                                {isMe && <span className="text-[10px] text-crown ml-1">(tú)</span>}
                              </span>
                              {pred ? (
                                <>
                                  <span className="text-xs font-black text-white tabular-nums">
                                    {pred.predicted_home_score} - {pred.predicted_away_score}
                                  </span>
                                  <span className={cn(
                                    'text-xs font-bold w-14 text-right tabular-nums',
                                    pred.is_calculated && pred.points_total > 0
                                      ? 'text-field-light'
                                      : pred.is_calculated
                                      ? 'text-gray-600'
                                      : 'text-gray-500'
                                  )}>
                                    {pred.is_calculated
                                      ? pred.points_total > 0 ? `+${pred.points_total} pts` : '0 pts'
                                      : '–'}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-gray-700 italic">Sin pred.</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })()}
    </div>

    {/* Podio modal */}
    {showPodio && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-surface-card border border-white/10 rounded-2xl w-full max-w-md animate-slide-up overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Crown className="text-crown" size={20} />
                Tu podio del Mundial
              </h2>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Puntos en juego</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {PODIO_STEPS.map((s, i) => (
                  <div
                    key={s.key}
                    className={cn(
                      'rounded-lg py-2 px-1 transition-all',
                      i === podioStep ? 'bg-crown/15 border border-crown/30' : 'opacity-50'
                    )}
                  >
                    <div className="text-xl mb-0.5">{s.medal}</div>
                    <div className={cn('text-sm font-bold', i === 0 ? 'text-crown' : i === 1 ? 'text-gray-300' : 'text-amber-600')}>+{s.pts} pts</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{s.label.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 mt-4">
              {PODIO_STEPS.map((s, i) => (
                <div key={s.key} className={cn('h-1 flex-1 rounded-full transition-all', i < podioStep ? 'bg-crown' : i === podioStep ? 'bg-crown/60' : 'bg-white/10')} />
              ))}
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-1">
              {podioStep > 0 && (
                <button onClick={() => { setPodioStep((s) => s - 1); setPodioSearch(''); }} className="text-gray-500 hover:text-gray-300 transition-colors">
                  <ChevronLeft size={16} />
                </button>
              )}
              <p className="text-sm font-bold text-white">{currentStep.medal} {currentStep.label}</p>
              <span className={cn('text-xs font-bold ml-auto', podioStep === 0 ? 'text-crown' : podioStep === 1 ? 'text-gray-300' : 'text-amber-600')}>
                +{currentStep.pts} pts
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3 ml-5">
              {podioStep === 0 ? '¿Qué selección crees que ganará el Mundial 2026?' : podioStep === 1 ? '¿Quién llegará a la final pero no ganará?' : '¿Qué selección quedará en tercer lugar?'}
            </p>

            {currentValue && (
              <div className="bg-crown/10 border border-crown/30 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-crown" />
                  <span className="text-white font-semibold text-sm">{currentValue}</span>
                </div>
                <button onClick={() => setStepValue(podioStep, '')} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">Cambiar</button>
              </div>
            )}

            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Busca un equipo..."
                value={podioSearch}
                onChange={(e) => setPodioSearch(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-field transition-colors text-sm"
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
                      currentValue === t.name ? 'bg-crown/15 border border-crown/40 text-white font-medium' : 'text-gray-300 hover:bg-white/5 hover:text-white'
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
                    <div key={s.key} className={cn('flex-1 rounded-lg px-2 py-1.5 text-center border', val ? 'border-white/10 bg-white/5' : 'border-white/5 opacity-40')}>
                      <div className="text-sm">{s.medal}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">{val || '–'}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {allDone && (
              <button
                onClick={handleSavePodio}
                disabled={savingPodio}
                className="w-full py-3.5 rounded-xl bg-crown text-surface font-bold text-sm disabled:opacity-50 hover:bg-crown-muted transition-colors"
              >
                {savingPodio ? 'Guardando...' : 'Guardar predicciones'}
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Grupos modal */}
    {showGroups && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-surface-card border border-white/10 rounded-2xl w-full max-w-md animate-slide-up overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">Grupos del Mundial</h2>
              <span className="text-sm text-gray-500">{groupStep + 1} / {WC_GROUPS.length}</span>
            </div>
            <div className="bg-white/5 rounded-xl p-3 mb-3">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Puntos en juego</p>
              <p className="text-sm text-gray-300">
                <span className="text-field font-bold">+2 pts</span> por cada equipo que aciertes pasando de grupos
              </p>
              <p className="text-xs text-gray-500 mt-1">Elige los 2 equipos que crees que pasan de cada grupo</p>
            </div>
            <div className="flex gap-0.5">
              {WC_GROUPS.map((g, i) => (
                <div
                  key={g}
                  className={cn('h-1 flex-1 rounded-full transition-all', i < groupStep ? 'bg-field' : i === groupStep ? 'bg-field/60' : 'bg-white/10')}
                />
              ))}
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-4">
              {groupStep > 0 && (
                <button onClick={() => setGroupStep((s) => s - 1)} className="text-gray-500 hover:text-gray-300 transition-colors">
                  <ChevronLeft size={16} />
                </button>
              )}
              <p className="text-sm font-bold text-white">Grupo {currentGroupLetter}</p>
              <span className={cn('text-xs font-bold ml-auto', currentGroupPicks.length === 2 ? 'text-green-400' : 'text-gray-500')}>
                {currentGroupPicks.length}/2 seleccionados
              </span>
            </div>

            {teamsInCurrentGroup.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">Sin equipos asignados a este grupo</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {teamsInCurrentGroup.map((t) => {
                  const selected = currentGroupPicks.includes(t.name);
                  const maxed = currentGroupPicks.length >= 2 && !selected;
                  return (
                    <button
                      key={t.id}
                      onClick={() => !maxed && toggleGroupTeam(t.name)}
                      disabled={maxed}
                      className={cn(
                        'px-3 py-3.5 rounded-xl text-sm transition-all flex items-center justify-between gap-2',
                        selected ? 'bg-green-500/20 border border-green-500/50 text-white font-semibold'
                          : maxed ? 'bg-white/3 border border-white/5 text-gray-600 cursor-not-allowed'
                          : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/20'
                      )}
                    >
                      <span className="truncate text-left leading-tight">{t.name}</span>
                      {selected && <Check size={13} className="text-green-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-6 pb-6">
            {groupsError && <p className="text-red-400 text-sm mb-3">{groupsError}</p>}
            {isLastGroup ? (
              <button
                onClick={handleSaveGroups}
                disabled={savingGroups || !canProceedGroup}
                className="w-full py-3.5 rounded-xl bg-field text-white font-bold text-sm disabled:opacity-50 hover:bg-field-muted transition-colors"
              >
                {savingGroups ? 'Guardando...' : 'Guardar predicciones'}
              </button>
            ) : (
              <button
                onClick={() => setGroupStep((s) => s + 1)}
                disabled={!canProceedGroup}
                className="w-full py-3.5 rounded-xl bg-field text-white font-bold text-sm disabled:opacity-50 hover:bg-field-muted transition-colors flex items-center justify-center gap-2"
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
