'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, ChevronRight, Plus, LogIn, Crown, X } from 'lucide-react';
import type { Team } from '@/types';
import { isTournamentLocked } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DashboardClientProps {
  groups: Array<{ group_id: string; groups: { id: string; name: string; description: string | null } | null }>;
  tournamentPrediction: { champion: string | null; runner_up: string | null; third_place: string | null } | null;
  teams: Team[];
}

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
  const [newGroupId, setNewGroupId] = useState('');
  const [champion, setChampion] = useState(tournamentPrediction?.champion ?? '');
  const [runnerUp, setRunnerUp] = useState(tournamentPrediction?.runner_up ?? '');
  const [thirdPlace, setThirdPlace] = useState(tournamentPrediction?.third_place ?? '');
  const [savingPodio, setSavingPodio] = useState(false);
  const [podioError, setPodioError] = useState('');

  const locked = isTournamentLocked();
  const teamOptions = [...teams].sort((a, b) => a.name.localeCompare(b.name));

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
      setShowPodio(true);
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
    setShowJoin(false);
    setJoinCode('');
    setNewGroupId(data.group.id);
    if (!locked) {
      setShowPodio(true);
    } else {
      router.push(`/groups/${data.group.id}`);
      router.refresh();
    }
  }

  async function handleSavePodio() {
    setPodioError('');
    if (!champion) { setPodioError('Elige un campeón'); return; }
    if (!runnerUp) { setPodioError('Elige el segundo clasificado'); return; }
    if (!thirdPlace) { setPodioError('Elige el tercer clasificado'); return; }

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
    setShowPodio(false);
    router.push(`/groups/${newGroupId}`);
    router.refresh();
  }

  function skipPodio() {
    setShowPodio(false);
    router.push(`/groups/${newGroupId}`);
    router.refresh();
  }

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-4 space-y-5 animate-fade-in">
        {/* My groups */}
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
                        {m.groups.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{m.groups.description}</p>
                        )}
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface-card border border-white/10 rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Crown className="text-crown" size={22} />
                Tu podio del Mundial
              </h2>
              <button onClick={skipPodio} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-5">
              ¿Quién crees que va a ganar el Mundial 2026? Puedes cambiarlo hasta que empiece.
            </p>

            <div className="space-y-4">
              {[
                { label: '🥇 Campeón del mundo', value: champion, setter: setChampion },
                { label: '🥈 Segundo clasificado', value: runnerUp, setter: setRunnerUp },
                { label: '🥉 Tercer clasificado', value: thirdPlace, setter: setThirdPlace },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="text-sm font-medium text-white mb-1.5 block">{label}</label>
                  <select
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className={cn(
                      'w-full bg-surface border rounded-xl px-4 py-3 text-white',
                      'focus:outline-none focus:border-field transition-colors text-sm appearance-none cursor-pointer',
                      value ? 'border-field/40' : 'border-white/10'
                    )}
                  >
                    <option value="">Selecciona un equipo...</option>
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {podioError && (
              <p className="text-red-400 text-sm mt-3">{podioError}</p>
            )}

            <div className="flex flex-col gap-2 mt-6">
              <button
                onClick={handleSavePodio}
                disabled={savingPodio}
                className="w-full py-3.5 rounded-xl bg-crown text-surface font-bold text-sm
                  disabled:opacity-50 hover:bg-crown-muted transition-colors"
              >
                {savingPodio ? 'Guardando...' : 'Guardar predicciones'}
              </button>
              <button
                onClick={skipPodio}
                className="w-full py-2.5 text-gray-500 text-sm hover:text-gray-300 transition-colors"
              >
                Saltar por ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
