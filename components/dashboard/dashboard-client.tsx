'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, ChevronRight, Plus, LogIn, Crown, X, Search, ChevronLeft, Check } from 'lucide-react';
import type { Team } from '@/types';
import { isTournamentLocked } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DashboardClientProps {
  groups: Array<{ group_id: string; member_count: number; groups: { id: string; name: string } | null }>;
  tournamentPrediction: { champion: string | null; runner_up: string | null; third_place: string | null } | null;
  teams: Team[];
}

const PODIO_STEPS = [
  { key: 'champion' as const, label: 'Campeón del Mundial', medal: '🥇', pts: 20, color: 'text-crown' },
  { key: 'runnerUp' as const, label: 'Segundo clasificado', medal: '🥈', pts: 10, color: 'text-gray-300' },
  { key: 'thirdPlace' as const, label: 'Tercer clasificado', medal: '🥉', pts: 5, color: 'text-amber-600' },
];

export function DashboardClient({
  groups,
  tournamentPrediction,
  teams,
}: DashboardClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showPodio, setShowPodio] = useState(false);
  const [podioStep, setPodioStep] = useState(0);
  const [podioSearch, setPodioSearch] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [champion, setChampion] = useState(tournamentPrediction?.champion ?? '');
  const [runnerUp, setRunnerUp] = useState(tournamentPrediction?.runner_up ?? '');
  const [thirdPlace, setThirdPlace] = useState(tournamentPrediction?.third_place ?? '');
  const [savingPodio, setSavingPodio] = useState(false);
  const [podioError, setPodioError] = useState('');

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
    setPodioStep(0);
    setPodioSearch('');
    setPodioError('');
    setShowPodio(true);
  }

  function closePodio() {
    setShowPodio(false);
    router.push(`/groups/${newGroupId}`);
    router.refresh();
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
    const res = await fetch('/api/predictions/tournament', {
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
    closePodio();
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
    setLoading(true);
    const res = await fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: joinCode }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    if (data.already_member) {
      setError('Ya eres miembro de este grupo');
      return;
    }
    setShowJoin(false);
    setJoinCode('');
    setNewGroupId(data.group.id);
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

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-4 space-y-5 animate-fade-in">
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

          {groups.length === 0 ? (
            <div className="bg-surface-card border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm">No estás en ningún grupo todavía</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((m) => {
                if (!m.groups) return null;
                return (
                  <Link key={m.group_id} href={`/groups/${m.groups.id}`}>
                    <div className="bg-surface-card border border-white/10 rounded-2xl p-4 flex items-center justify-between card-hover">
                      <div>
                        <p className="font-semibold text-white">{m.groups.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {m.member_count} {m.member_count === 1 ? 'miembro' : 'miembros'}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-gray-500" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Podio modal */}
      {showPodio && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-white/10 rounded-2xl w-full max-w-md animate-slide-up overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Crown className="text-crown" size={20} />
                  Tu podio del Mundial
                </h2>
                <button onClick={closePodio} className="text-gray-500 hover:text-gray-300 transition-colors p-1">
                  <X size={18} />
                </button>
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
                  onClick={closePodio}
                  className="w-full py-2.5 text-gray-500 text-sm hover:text-gray-300 transition-colors"
                >
                  Saltar por ahora
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
