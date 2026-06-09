'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationGuard } from '@/hooks/use-navigation-guard';
import Link from 'next/link';
import { Users, ChevronRight, Plus, LogIn, Crown, Search, ChevronLeft, Check, Bell, X, Loader2 } from 'lucide-react';
import type { Team } from '@/types';
import { isTournamentLocked, WC_GROUPS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { triggerAchievementCheck } from '@/components/ui/achievement-checker';

interface GroupInvite {
  id: string;
  group_id: string;
  group_name: string;
  inviter_username: string;
  created_at: string;
}

interface DashboardClientProps {
  userId: string;
  groups: Array<{ group_id: string; member_count: number; is_admin: boolean; groups: { id: string; name: string } | null }>;
  tournamentPrediction: { champion: string | null; runner_up: string | null; third_place: string | null } | null;
  teams: Team[];
  groupInvites: GroupInvite[];
}

const PODIO_STEPS = [
  { key: 'champion' as const, label: 'Campeón del Mundial', medal: '🥇', pts: 20, color: 'text-crown' },
  { key: 'runnerUp' as const, label: 'Segundo clasificado', medal: '🥈', pts: 10, color: 'text-gray-300' },
  { key: 'thirdPlace' as const, label: 'Tercer clasificado', medal: '🥉', pts: 5, color: 'text-amber-600' },
];

export function DashboardClient({
  userId,
  groups,
  tournamentPrediction,
  teams,
  groupInvites: initialInvites,
}: DashboardClientProps) {
  const router = useRouter();
  const [pendingInvites, setPendingInvites] = useState<GroupInvite[]>(initialInvites);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [acceptedPendingGroup, setAcceptedPendingGroup] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joinPending, setJoinPending] = useState(false);

  const [showPodio, setShowPodio] = useState(false);
  const [podioStep, setPodioStep] = useState(0);
  const [podioSearch, setPodioSearch] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [champion, setChampion] = useState(tournamentPrediction?.champion ?? '');
  const [runnerUp, setRunnerUp] = useState(tournamentPrediction?.runner_up ?? '');
  const [thirdPlace, setThirdPlace] = useState(tournamentPrediction?.third_place ?? '');
  const [savingPodio, setSavingPodio] = useState(false);
  const [podioError, setPodioError] = useState('');

  const [showGroups, setShowGroups] = useState(false);
  const [groupStep, setGroupStep] = useState(0);
  const [groupPicks, setGroupPicks] = useState<Record<string, string[]>>({});
  const [savingGroups, setSavingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState('');

  useNavigationGuard(showPodio || showGroups);

  // Real-time: receive group invite notifications
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notify:${userId}`)
      .on('broadcast', { event: 'group_invite' }, ({ payload }) => {
        const invite = payload.invite as GroupInvite;
        setPendingInvites((prev) => prev.find((i) => i.id === invite.id) ? prev : [invite, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function respondToInvite(invite: GroupInvite, action: 'accept' | 'reject') {
    setRespondingId(invite.id);
    const res = await fetch(`/api/groups/${invite.group_id}/invite/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: invite.id, action }),
    });
    setRespondingId(null);
    setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
    if (res.ok && action === 'accept') {
      const data = await res.json();
      if (data.pending) {
        setAcceptedPendingGroup(invite.group_name);
      } else {
        router.push(`/groups/${invite.group_id}`);
        router.refresh();
      }
    }
  }

  const locked = isTournamentLocked();
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

  function openPodio() {
    setChampion('');
    setRunnerUp('');
    setThirdPlace('');
    setPodioStep(0);
    setPodioSearch('');
    setPodioError('');
    setShowPodio(true);
  }

  function redirectToGroup() {
    router.push(`/groups/${newGroupId}`);
    router.refresh();
  }

  function toggleGroupTeam(teamName: string) {
    const group = WC_GROUPS[groupStep];
    setGroupPicks((prev) => {
      const picks = prev[group] || [];
      if (picks.includes(teamName)) {
        return { ...prev, [group]: picks.filter((t) => t !== teamName) };
      }
      if (picks.length >= 2) return prev;
      return { ...prev, [group]: [...picks, teamName] };
    });
  }

  async function handleSaveGroups() {
    setSavingGroups(true);
    setGroupsError('');
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
    redirectToGroup();
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
    const res = await fetch(`/api/groups/${newGroupId}/podio`, {
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
    setShowPodio(false);
    setGroupStep(0);
    setGroupPicks({});
    setGroupsError('');
    setShowGroups(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setShowCreate(false);
    setCreateForm({ name: '', description: '' });
    setNewGroupId(data.group.id);
    triggerAchievementCheck();
    if (!locked) {
      openPodio();
    } else {
      router.push(`/groups/${data.group.id}`);
      router.refresh();
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const code = joinCode;
    // Close modal + show pending immediately (optimistic)
    setShowJoin(false);
    setJoinCode('');
    setJoinPending(true);

    const res = await fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code }),
    });
    const data = await res.json();

    if (!res.ok) {
      setJoinPending(false);
      setJoinCode(code);
      setShowJoin(true);
      setError(data.error);
      return;
    }
    if (data.already_member) {
      setJoinPending(false);
      setJoinCode(code);
      setShowJoin(true);
      setError('Ya eres miembro de este grupo');
      return;
    }
    if (data.pending) {
      // Already showing pending banner, nothing more to do
      return;
    }
    // Direct join — navigate to group
    setJoinPending(false);
    setNewGroupId(data.group.id);
    triggerAchievementCheck();
    if (!locked) {
      openPodio();
    } else {
      router.push(`/groups/${data.group.id}`);
      router.refresh();
    }
  }

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

  const currentGroupLetter = WC_GROUPS[groupStep];
  const teamsInCurrentGroup = teams.filter((t) => t.group_name === currentGroupLetter);
  const currentGroupPicks = groupPicks[currentGroupLetter] || [];
  const isLastGroup = groupStep === WC_GROUPS.length - 1;
  const canProceedGroup = currentGroupPicks.length === 2;

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-4 space-y-5 animate-fade-in">

        {/* Accepted invite pending admin approval banner */}
        {acceptedPendingGroup && (
          <div className="bg-field/10 border border-field/30 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-lg">⏳</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Solicitud enviada</p>
              <p className="text-xs text-gray-400 mt-0.5">
                El admin de <span className="text-white font-medium">{acceptedPendingGroup}</span> debe aceptarte para unirte.
              </p>
            </div>
            <button onClick={() => setAcceptedPendingGroup(null)} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Group invite notifications */}
        {pendingInvites.length > 0 && (
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="bg-gradient-to-r from-field/15 to-field-dark/10 border border-field/30 rounded-2xl p-4 flex items-start gap-3"
              >
                <div className="shrink-0 w-8 h-8 rounded-xl bg-field/20 border border-field/30 flex items-center justify-center mt-0.5">
                  <Bell size={14} className="text-field-light" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Invitación al grupo
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="text-field-light font-medium">{invite.inviter_username}</span> te ha invitado a{' '}
                    <span className="text-white font-medium">{invite.group_name}</span>
                  </p>
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => respondToInvite(invite, 'accept')}
                      disabled={respondingId === invite.id}
                      className="flex items-center gap-1.5 bg-field text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-field-muted transition-colors disabled:opacity-50"
                    >
                      {respondingId === invite.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      Aceptar
                    </button>
                    <button
                      onClick={() => respondToInvite(invite, 'reject')}
                      disabled={respondingId === invite.id}
                      className="flex items-center gap-1.5 border border-white/15 text-gray-400 text-xs px-3 py-1.5 rounded-lg hover:border-white/30 hover:text-gray-300 transition-colors disabled:opacity-50"
                    >
                      <X size={11} />
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users size={18} className="text-field-light" />
              Mis grupos
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowJoin(true); setShowCreate(false); setError(''); }}
                className="flex items-center gap-1.5 bg-surface-card border border-white/10 text-gray-300
                  px-3 py-1.5 rounded-xl text-xs hover:border-field/50 transition-colors"
              >
                <LogIn size={13} />
                Unirse
              </button>
              <button
                onClick={() => { setShowCreate(true); setShowJoin(false); setError(''); }}
                className="flex items-center gap-1.5 bg-field text-white px-3 py-1.5 rounded-xl text-xs
                  hover:bg-field-muted transition-colors font-medium"
              >
                <Plus size={13} />
                Crear
              </button>
            </div>
          </div>

          {showCreate && (
            <div className="bg-surface-card border border-field/30 rounded-2xl p-5 mb-3 animate-slide-up">
              <h3 className="font-bold text-white mb-4">Crear grupo</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <input
                  type="text"
                  placeholder="Nombre del grupo"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-gray-600 focus:outline-none focus:border-field transition-colors text-sm"
                />
                <input
                  type="text"
                  placeholder="Descripción (opcional)"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-gray-600 focus:outline-none focus:border-field transition-colors text-sm"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setError(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:border-white/20 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-field text-white text-sm font-semibold disabled:opacity-50 hover:bg-field-muted transition-colors"
                  >
                    {loading ? 'Creando...' : 'Crear grupo'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {showJoin && (
            <div className="bg-surface-card border border-crown/30 rounded-2xl p-5 mb-3 animate-slide-up">
              <h3 className="font-bold text-white mb-4">Unirse con código</h3>
              <form onSubmit={handleJoin} className="space-y-3">
                <input
                  type="text"
                  placeholder="Código de invitación (ej: AB12CD34)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  required
                  className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-gray-600 focus:outline-none focus:border-crown transition-colors text-sm tracking-widest uppercase"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowJoin(false); setError(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:border-white/20 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-crown text-surface text-sm font-bold disabled:opacity-50 hover:bg-crown-muted transition-colors"
                  >
                    {loading ? 'Uniéndome...' : 'Unirse'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {joinPending && (
            <div className="bg-field/10 border border-field/30 rounded-2xl p-4 mb-1 flex items-start gap-3">
              <span className="text-lg">⏳</span>
              <div>
                <p className="text-sm font-semibold text-white">Solicitud enviada</p>
                <p className="text-xs text-gray-400 mt-0.5">El admin del grupo debe aceptarte para unirte.</p>
              </div>
              <button onClick={() => setJoinPending(false)} className="ml-auto text-gray-500 hover:text-gray-300 transition-colors">
                <span className="text-sm">✕</span>
              </button>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="bg-surface-card border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-field/20 to-field-dark/30 border border-field/20 flex items-center justify-center mx-auto mb-3">
                <Users size={22} className="text-field-light" />
              </div>
              <p className="text-gray-400 text-sm">No estás en ningún grupo todavía</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((m) => {
                if (!m.groups) return null;
                const initials = m.groups.name.slice(0, 2).toUpperCase();
                return (
                  <Link key={m.group_id} href={`/groups/${m.groups.id}`} className="block">
                    <div className={cn(
                      "group relative bg-surface-card border rounded-2xl overflow-hidden transition-all duration-200 card-hover",
                      m.is_admin
                        ? "border-crown/30 hover:border-crown/60 hover:shadow-lg hover:shadow-crown/5"
                        : "border-white/10 hover:border-field/40 hover:shadow-lg hover:shadow-field/5"
                    )}>
                      <div className={cn(
                        "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r to-transparent",
                        m.is_admin ? "from-crown via-crown/60" : "from-field via-field-light/60"
                      )} />
                      <div className="p-4 pt-5 flex items-center gap-3">
                        <div className={cn(
                          "shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br border flex items-center justify-center",
                          m.is_admin
                            ? "from-crown/30 to-crown-dark/60 border-crown/25"
                            : "from-field/30 to-field-dark/60 border-field/25"
                        )}>
                          {m.is_admin
                            ? <Crown size={16} className="text-crown" />
                            : <Users size={16} className="text-field-light" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white truncate">{m.groups.name}</p>
                            {m.is_admin && (
                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-crown bg-crown/15 border border-crown/30 rounded-full px-2 py-0.5">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Users size={10} className="text-gray-500" />
                            <p className="text-xs text-gray-500">
                              {m.member_count} {m.member_count === 1 ? 'miembro' : 'miembros'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          size={15}
                          className="text-gray-500 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-field-light"
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Grupos modal */}
      {showGroups && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-surface-card border border-white/10 rounded-2xl w-full max-w-md animate-slide-up overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-white">Grupos del Mundial</h2>
                <span className="text-sm text-gray-500">{groupStep + 1} / {WC_GROUPS.length}</span>
              </div>

              {/* Points explanation */}
              <div className="bg-white/5 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Puntos en juego</p>
                <p className="text-sm text-gray-300">
                  <span className="text-field font-bold">+5 pts</span> si aciertas los dos equipos del grupo
                </p>
                <p className="text-sm text-gray-300 mt-0.5">
                  <span className="text-blue-400 font-bold">+2 pts</span> si aciertas solo uno
                </p>
                <p className="text-xs text-gray-500 mt-1">Elige los 2 equipos que crees que pasan de cada grupo</p>
              </div>

              {/* Progress bar */}
              <div className="flex gap-0.5">
                {WC_GROUPS.map((g, i) => (
                  <div
                    key={g}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all',
                      i < groupStep ? 'bg-field' : i === groupStep ? 'bg-field/60' : 'bg-white/10'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Group content */}
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-4">
                {groupStep > 0 && (
                  <button
                    onClick={() => setGroupStep((s) => s - 1)}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                <p className="text-sm font-bold text-white">Grupo {currentGroupLetter}</p>
                <span className={cn(
                  'text-xs font-bold ml-auto',
                  currentGroupPicks.length === 2 ? 'text-green-400' : 'text-gray-500'
                )}>
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
                          selected
                            ? 'bg-green-500/20 border border-green-500/50 text-white font-semibold'
                            : maxed
                            ? 'bg-white/3 border border-white/5 text-gray-600 cursor-not-allowed'
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

            {/* Footer */}
            <div className="px-6 pb-6">
              {groupsError && (
                <p className="text-red-400 text-sm mb-3">{groupsError}</p>
              )}

              {isLastGroup ? (
                <button
                  onClick={handleSaveGroups}
                  disabled={savingGroups || !canProceedGroup}
                  className="w-full py-3.5 rounded-xl bg-field text-white font-bold text-sm
                    disabled:opacity-50 hover:bg-field-muted transition-colors"
                >
                  {savingGroups ? 'Guardando...' : 'Guardar predicciones'}
                </button>
              ) : (
                <button
                  onClick={() => setGroupStep((s) => s + 1)}
                  disabled={!canProceedGroup}
                  className="w-full py-3.5 rounded-xl bg-field text-white font-bold text-sm
                    disabled:opacity-50 hover:bg-field-muted transition-colors flex items-center justify-center gap-2"
                >
                  Siguiente
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Podio modal */}
      {showPodio && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-surface-card border border-white/10 rounded-2xl w-full max-w-md animate-slide-up overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Crown className="text-crown" size={20} />
                  Tu podio del Mundial
                </h2>
              </div>

              {/* Points guide */}
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
                      <div className={cn('text-sm font-bold', s.color)}>+{s.pts} pts</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {s.label.split(' ')[0]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex gap-1.5 mt-4">
                {PODIO_STEPS.map((s, i) => (
                  <div
                    key={s.key}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all',
                      i < podioStep ? 'bg-crown' : i === podioStep ? 'bg-crown/60' : 'bg-white/10'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Step content */}
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
                <p className="text-sm font-bold text-white">
                  {currentStep.medal} {currentStep.label}
                </p>
                <span className={cn('text-xs font-bold ml-auto', currentStep.color)}>
                  +{currentStep.pts} pts
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3 ml-5">
                {podioStep === 0
                  ? '¿Qué selección crees que ganará el Mundial 2026?'
                  : podioStep === 1
                  ? '¿Quién llegará a la final pero no ganará?'
                  : '¿Qué selección quedará en tercer lugar?'}
              </p>

              {/* Selected value */}
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

              {/* Search */}
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

              {/* Team list */}
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

            {/* Footer */}
            <div className="px-6 pb-6">
              {podioError && (
                <p className="text-red-400 text-sm mb-3">{podioError}</p>
              )}

              {/* Summary of selections */}
              {(champion || runnerUp || thirdPlace) && (
                <div className="flex gap-2 mb-3">
                  {PODIO_STEPS.map((s, i) => {
                    const val = i === 0 ? champion : i === 1 ? runnerUp : thirdPlace;
                    return (
                      <div key={s.key} className={cn(
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

              {allDone && (
                <button
                  onClick={handleSavePodio}
                  disabled={savingPodio}
                  className="w-full py-3.5 rounded-xl bg-crown text-surface font-bold text-sm
                    disabled:opacity-50 hover:bg-crown-muted transition-colors"
                >
                  {savingPodio ? 'Guardando...' : 'Guardar predicciones'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
