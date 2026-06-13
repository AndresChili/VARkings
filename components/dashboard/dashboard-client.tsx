'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationGuard } from '@/hooks/use-navigation-guard';
import Link from 'next/link';
import { Users, ChevronRight, Plus, LogIn, Crown, Search, ChevronLeft, Check, Bell, X, Loader2, Sparkles } from 'lucide-react';
import type { Team } from '@/types';
import { isKnockoutStarted, WC_GROUPS } from '@/lib/utils';
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

type GroupEntry = { group_id: string; member_count: number; is_admin: boolean; groups: { id: string; name: string } | null };

interface DashboardClientProps {
  userId: string;
  groups: GroupEntry[];
  tournamentPrediction: { champion: string | null; runner_up: string | null; third_place: string | null } | null;
  teams: Team[];
  groupInvites: GroupInvite[];
}

const PODIO_STEPS = [
  { key: 'champion' as const, label: 'Campeón del Mundial', medal: '🥇', pts: 20, color: 'text-crown' },
  { key: 'runnerUp' as const, label: 'Segundo clasificado', medal: '🥈', pts: 10, color: 'text-gray-300' },
  { key: 'thirdPlace' as const, label: 'Tercer clasificado', medal: '🥉', pts: 5, color: 'text-amber-600' },
];

function GroupCard({ m }: { m: GroupEntry }) {
  if (!m.groups) return null;
  return (
    <Link href={`/groups/${m.groups.id}`} className="block group">
      <div className={cn(
        'relative overflow-hidden rounded-2xl border-[1.5px] transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.99]',
        m.is_admin
          ? 'bg-gradient-to-br from-[#1c1506] via-surface-card to-surface-card border-crown/25 hover:border-crown/50 hover:shadow-crown/15'
          : 'bg-gradient-to-br from-[#061510] via-surface-card to-surface-card border-field/20 hover:border-field/45 hover:shadow-field/15'
      )}>
        {/* Ambient glow */}
        <div className={cn(
          'absolute -top-8 -right-8 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-25',
          m.is_admin ? 'bg-crown' : 'bg-field-light'
        )} />

        {/* Top edge shimmer */}
        <div className={cn(
          'absolute top-0 left-8 right-8 h-px',
          m.is_admin
            ? 'bg-gradient-to-r from-transparent via-crown/40 to-transparent'
            : 'bg-gradient-to-r from-transparent via-field-light/30 to-transparent'
        )} />

        <div className="relative p-4 flex items-center gap-4">
          {/* Icon */}
          <div className={cn(
            'shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg',
            m.is_admin
              ? 'bg-gradient-to-br from-crown/30 to-crown-dark/15 border border-crown/30 shadow-crown/20'
              : 'bg-gradient-to-br from-field/30 to-field-dark/15 border border-field/25 shadow-field/15'
          )}>
            {m.is_admin
              ? <Crown size={20} className="text-crown" />
              : <Users size={20} className="text-field-light" />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-[15px] tracking-tight truncate leading-tight mb-1.5">
              {m.groups.name}
            </p>
            <div className="flex items-center gap-2">
              {m.is_admin && (
                <span className="text-[10px] font-black uppercase tracking-widest text-crown/90 bg-crown/10 border border-crown/20 rounded-full px-2 py-0.5 leading-none">
                  Admin
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  m.is_admin ? 'bg-crown/50' : 'bg-field/60'
                )} />
                <span className="text-xs text-gray-500">
                  {m.member_count} {m.member_count === 1 ? 'miembro' : 'miembros'}
                </span>
              </div>
            </div>
          </div>

          {/* Arrow button */}
          <div className={cn(
            'shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200',
            'group-hover:translate-x-0.5',
            m.is_admin
              ? 'bg-crown/8 border border-crown/15 group-hover:bg-crown/18 group-hover:border-crown/30'
              : 'bg-white/4 border border-white/8 group-hover:bg-field/12 group-hover:border-field/25'
          )}>
            <ChevronRight size={14} className={cn(
              'transition-colors duration-200',
              m.is_admin ? 'text-crown/50 group-hover:text-crown' : 'text-gray-600 group-hover:text-field-light'
            )} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function DashboardClient({
  userId,
  groups: initialGroups,
  tournamentPrediction,
  teams,
  groupInvites: initialInvites,
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [localGroups, setLocalGroups] = useState<GroupEntry[]>(initialGroups);
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

  useEffect(() => {
    const channel = supabase
      .channel(`notify:${userId}`)
      .on('broadcast', { event: 'group_invite' }, ({ payload }) => {
        const invite = payload.invite as GroupInvite;
        setPendingInvites((prev) => prev.find((i) => i.id === invite.id) ? prev : [invite, ...prev]);
      })
      .on('broadcast', { event: 'join_request_accepted' }, ({ payload }) => {
        const { group_id, group_name } = payload as { group_id: string; group_name: string };
        setLocalGroups((prev) => {
          if (prev.find((g) => g.group_id === group_id)) return prev;
          return [...prev, { group_id, member_count: 0, is_admin: false, groups: { id: group_id, name: group_name } }];
        });
      })
      .on('broadcast', { event: 'member_removed' }, ({ payload }) => {
        const { group_id } = payload as { group_id: string };
        setLocalGroups((prev) => prev.filter((g) => g.group_id !== group_id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, userId]);

  async function respondToInvite(invite: GroupInvite, action: 'accept' | 'reject') {
    setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));

    const res = await fetch(`/api/groups/${invite.group_id}/invite/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: invite.id, action }),
    });

    if (!res.ok) {
      setPendingInvites((prev) => [...prev, invite]);
      return;
    }

    if (action === 'accept') {
      const data = await res.json();
      if (data.pending) {
        setAcceptedPendingGroup(invite.group_name);
      } else {
        setLocalGroups((prev) => {
          if (prev.find((g) => g.group_id === invite.group_id)) return prev;
          return [...prev, { group_id: invite.group_id, member_count: 0, is_admin: false, groups: { id: invite.group_id, name: invite.group_name } }];
        });
        router.push(`/groups/${invite.group_id}`);
      }
    }
  }

  const locked = isKnockoutStarted();
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
      return;
    }
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

  const adminGroups = localGroups.filter((g) => g.is_admin && g.groups);
  const memberGroups = localGroups.filter((g) => !g.is_admin && g.groups);

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-5 space-y-5 animate-fade-in">

        {/* ── Banners ── */}
        {acceptedPendingGroup && (
          <div className="relative overflow-hidden bg-gradient-to-r from-field/12 to-field-dark/8 border border-field/25 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl">⏳</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Solicitud enviada</p>
              <p className="text-xs text-gray-400 mt-0.5">
                El admin de <span className="text-field-light font-semibold">{acceptedPendingGroup}</span> debe aceptarte para unirte.
              </p>
            </div>
            <button onClick={() => setAcceptedPendingGroup(null)} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 mt-0.5">
              <X size={15} />
            </button>
          </div>
        )}

        {pendingInvites.length > 0 && (
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="relative overflow-hidden bg-gradient-to-r from-field/12 to-field-dark/6 border border-field/25 rounded-2xl p-4 flex items-start gap-3"
              >
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-field/15 blur-2xl pointer-events-none" />
                <div className="shrink-0 w-9 h-9 rounded-xl bg-field/20 border border-field/30 flex items-center justify-center mt-0.5">
                  <Bell size={15} className="text-field-light" />
                </div>
                <div className="relative flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Invitación al grupo</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="text-field-light font-semibold">{invite.inviter_username}</span> te ha invitado a{' '}
                    <span className="text-white font-semibold">{invite.group_name}</span>
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => respondToInvite(invite, 'accept')}
                      disabled={respondingId === invite.id}
                      className="flex items-center gap-1.5 bg-field text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-field-muted transition-colors disabled:opacity-50 shadow-sm shadow-field/30"
                    >
                      {respondingId === invite.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      Aceptar
                    </button>
                    <button
                      onClick={() => respondToInvite(invite, 'reject')}
                      disabled={respondingId === invite.id}
                      className="flex items-center gap-1.5 border border-white/12 text-gray-500 text-xs px-3.5 py-2 rounded-xl hover:border-white/25 hover:text-gray-300 transition-colors disabled:opacity-50"
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

        {/* ── Page header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Users size={20} className="text-field-light" />
              Mis grupos
            </h1>
            {localGroups.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5 ml-7">
                {localGroups.length} {localGroups.length === 1 ? 'grupo activo' : 'grupos activos'}
              </p>
            )}
          </div>
          {localGroups.length > 0 && (
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-field/20 to-field-dark/20 border border-field/20 flex items-center justify-center">
              <Sparkles size={16} className="text-field-light" />
            </div>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setShowCreate((v) => !v); setShowJoin(false); setError(''); }}
            className={cn(
              'group relative overflow-hidden flex flex-col items-center justify-center gap-3 py-5 px-4 rounded-2xl',
              'transition-all duration-200 active:scale-[0.97]',
              showCreate
                ? 'bg-gradient-to-br from-field to-field-dark border-[1.5px] border-field-light/30 shadow-lg shadow-field/30 scale-[0.98]'
                : 'bg-gradient-to-br from-field to-field-dark border-[1.5px] border-field-light/15 shadow-lg shadow-field/20 hover:shadow-field/35 hover:border-field-light/30'
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.07),_transparent_65%)] pointer-events-none" />
            <div className={cn(
              'relative w-11 h-11 rounded-xl border flex items-center justify-center transition-all duration-200',
              'bg-white/10 border-white/12 group-hover:bg-white/15'
            )}>
              <Plus
                size={22}
                strokeWidth={2.5}
                className={cn('text-white transition-transform duration-200', showCreate && 'rotate-45')}
              />
            </div>
            <span className="relative text-sm font-bold text-white tracking-wide">Crear grupo</span>
          </button>

          <button
            onClick={() => { setShowJoin((v) => !v); setShowCreate(false); setError(''); }}
            className={cn(
              'group relative overflow-hidden flex flex-col items-center justify-center gap-3 py-5 px-4 rounded-2xl',
              'transition-all duration-200 active:scale-[0.97]',
              showJoin
                ? 'bg-surface-hover border-[1.5px] border-white/20 scale-[0.98]'
                : 'bg-surface-card border-[1.5px] border-white/10 hover:border-white/20 hover:bg-surface-hover'
            )}
          >
            <div className={cn(
              'w-11 h-11 rounded-xl border flex items-center justify-center transition-all duration-200',
              'bg-white/5 border-white/10 group-hover:bg-white/10 group-hover:border-white/18'
            )}>
              <LogIn size={20} className="text-gray-300 group-hover:text-white transition-colors duration-200" />
            </div>
            <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors duration-200 tracking-wide">
              Unirse
            </span>
          </button>
        </div>

        {/* ── Create form ── */}
        {showCreate && (
          <div className="relative overflow-hidden bg-surface-card border-[1.5px] border-field/30 rounded-2xl p-5 animate-slide-up">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-field/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-field/20 border border-field/30 flex items-center justify-center">
                  <Plus size={14} className="text-field-light" />
                </div>
                Crear grupo
              </h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <input
                  type="text"
                  placeholder="Nombre del grupo"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-gray-600 focus:outline-none focus:border-field/50 focus:bg-surface-hover transition-colors text-sm"
                />
                <input
                  type="text"
                  placeholder="Descripción (opcional)"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-gray-600 focus:outline-none focus:border-field/50 focus:bg-surface-hover transition-colors text-sm"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setError(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:border-white/20 hover:text-gray-300 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-field text-white text-sm font-bold disabled:opacity-50 hover:bg-field-muted transition-colors shadow-sm shadow-field/30"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Crear grupo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Join form ── */}
        {showJoin && (
          <div className="relative overflow-hidden bg-surface-card border-[1.5px] border-white/15 rounded-2xl p-5 animate-slide-up">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/3 blur-3xl pointer-events-none" />
            <div className="relative">
              <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center">
                  <LogIn size={14} className="text-gray-300" />
                </div>
                Unirse con código
              </h3>
              <form onSubmit={handleJoin} className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="AB12CD34"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    required
                    className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white text-center
                      placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-surface-hover
                      transition-colors text-base tracking-[0.3em] uppercase font-mono font-bold"
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowJoin(false); setError(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:border-white/20 hover:text-gray-300 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-bold disabled:opacity-50 hover:bg-white/15 hover:border-white/25 transition-colors"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Unirse'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Join pending banner ── */}
        {joinPending && (
          <div className="bg-surface-card border border-white/10 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl">⏳</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Solicitud enviada</p>
              <p className="text-xs text-gray-400 mt-0.5">El admin del grupo debe aceptarte para unirte.</p>
            </div>
            <button onClick={() => setJoinPending(false)} className="text-gray-600 hover:text-gray-400 transition-colors mt-0.5">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Groups list ── */}
        {localGroups.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-surface-card py-12 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-field/5 to-transparent pointer-events-none" />
            <div className="relative flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-field/20 to-field-dark/10 border border-field/15 flex items-center justify-center">
                <Users size={32} className="text-field-light opacity-50" />
              </div>
              <div>
                <p className="text-white font-bold text-base">Sin grupos todavía</p>
                <p className="text-gray-500 text-sm mt-1">Crea uno o únete con un código</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {adminGroups.length > 0 && (
              <div className="space-y-2.5">
                {adminGroups.map((m) => <GroupCard key={m.group_id} m={m} />)}
              </div>
            )}
            {adminGroups.length > 0 && memberGroups.length > 0 && (
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Miembro</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            )}
            {memberGroups.length > 0 && (
              <div className="space-y-2.5">
                {memberGroups.map((m) => <GroupCard key={m.group_id} m={m} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Grupos prediction modal ── */}
      {showGroups && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-surface-card border border-white/10 rounded-2xl w-full max-w-md animate-slide-up overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-white">Grupos del Mundial</h2>
                <span className="text-sm text-gray-500">{groupStep + 1} / {WC_GROUPS.length}</span>
              </div>
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

      {/* ── Podio prediction modal ── */}
      {showPodio && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
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
                      <div className={cn('text-sm font-bold', s.color)}>+{s.pts} pts</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{s.label.split(' ')[0]}</div>
                    </div>
                  ))}
                </div>
              </div>
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
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-1">
                {podioStep > 0 && (
                  <button onClick={() => { setPodioStep((s) => s - 1); setPodioSearch(''); }} className="text-gray-500 hover:text-gray-300 transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                )}
                <p className="text-sm font-bold text-white">{currentStep.medal} {currentStep.label}</p>
                <span className={cn('text-xs font-bold ml-auto', currentStep.color)}>+{currentStep.pts} pts</span>
              </div>
              <p className="text-xs text-gray-500 mb-3 ml-5">
                {podioStep === 0
                  ? '¿Qué selección crees que ganará el Mundial 2026?'
                  : podioStep === 1
                  ? '¿Quién llegará a la final pero no ganará?'
                  : '¿Qué selección quedará en tercer lugar?'}
              </p>
              {currentValue && (
                <div className="bg-crown/10 border border-crown/30 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-crown" />
                    <span className="text-white font-semibold text-sm">{currentValue}</span>
                  </div>
                  <button onClick={() => setStepValue(podioStep, '')} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
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
    </>
  );
}
