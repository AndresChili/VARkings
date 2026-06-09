'use client';

import { useState } from 'react';
import { Trophy, Shield, CheckCircle, Lock, Crown, Star, X } from 'lucide-react';
import type { Team, TournamentPrediction } from '@/types';
import { cn, WC_GROUPS, isTournamentLocked, getTournamentDeadlineText, TOURNAMENT_LOCK_DATE } from '@/lib/utils';
import { triggerAchievementCheck } from '@/components/ui/achievement-checker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ActualPodio {
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
}

interface TournamentPredictionsClientProps {
  teams: Team[];
  existingPrediction: TournamentPrediction | null;
  groupQualifiers: Record<string, string[]>;
  actualPodio: ActualPodio | null;
}

export function TournamentPredictionsClient({ teams, existingPrediction, groupQualifiers, actualPodio }: TournamentPredictionsClientProps) {
  const locked = isTournamentLocked();

  const [champion, setChampion] = useState(existingPrediction?.champion ?? '');
  const [runnerUp, setRunnerUp] = useState(existingPrediction?.runner_up ?? '');
  const [thirdPlace, setThirdPlace] = useState(existingPrediction?.third_place ?? '');
  const [groupPreds, setGroupPreds] = useState<Record<string, [string, string]>>(
    (existingPrediction?.group_predictions as Record<string, [string, string]>) ?? {}
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasSaved, setHasSaved] = useState(!!existingPrediction);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'podio' | 'grupos'>('podio');

  const teamsByGroup: Record<string, Team[]> = {};
  teams.forEach((t) => {
    const g = t.group_name ?? 'Sin grupo';
    if (!teamsByGroup[g]) teamsByGroup[g] = [];
    teamsByGroup[g].push(t);
  });

  function setGroupTeam(group: string, idx: 0 | 1, value: string) {
    setGroupPreds((prev) => {
      const current = prev[group] ?? ['', ''];
      const updated = [...current] as [string, string];
      updated[idx] = value;
      return { ...prev, [group]: updated };
    });
  }

  function getGroupProgress(): number {
    const groups = Object.keys(teamsByGroup).filter((g) => g !== 'Sin grupo');
    if (groups.length === 0) return 0;
    const completed = groups.filter((g) => {
      const pred = groupPreds[g];
      return pred && pred[0] && pred[1];
    });
    return Math.round((completed.length / groups.length) * 100);
  }

  async function handleSave() {
    setError('');
    if (!champion) { setError('Elige un campeón'); return; }
    if (!runnerUp) { setError('Elige el segundo clasificado'); return; }
    if (!thirdPlace) { setError('Elige el tercero'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/predictions/tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          champion,
          runner_up: runnerUp,
          third_place: thirdPlace,
          group_predictions: groupPreds,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSaved(true);
      setHasSaved(true);
      setTimeout(() => setSaved(false), 3000);
      triggerAchievementCheck();
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const teamOptions = teams.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Crown className="text-crown" size={24} />
          Predicciones del torneo
        </h1>
        <p className={cn(
          'text-sm mt-1',
          locked ? 'text-red-400' : 'text-gray-400'
        )}>
          {locked ? '🔒 Predicciones cerradas' : getTournamentDeadlineText()}
        </p>
        {!locked && (
          <p className="text-xs text-gray-500 mt-0.5">
            Cierra el {format(TOURNAMENT_LOCK_DATE, "d 'de' MMMM 'a las' HH:mm", { locale: es })}
          </p>
        )}
      </div>

      {/* Points guide */}
      <div className="bg-crown/5 border border-crown/20 rounded-2xl p-4">
        <h3 className="text-xs font-bold text-crown uppercase tracking-wider mb-3">Puntos disponibles</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-300">🥇 Campeón</span>
            <span className="text-crown font-bold">20 pts</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">🥈 Segundo</span>
            <span className="text-crown font-bold">10 pts</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">🥉 Tercero</span>
            <span className="text-crown font-bold">5 pts</span>
          </div>
          <div className="border-t border-white/10 pt-2 mt-1">
            <div className="flex justify-between">
              <span className="text-gray-300">Equipo en podio, posición incorrecta</span>
              <span className="text-orange-400 font-bold">3 pts/equipo</span>
            </div>
          </div>
          <div className="border-t border-white/10 pt-2 mt-1">
            <div className="flex justify-between">
              <span className="text-gray-300">Ambos clasificados de grupo</span>
              <span className="text-field-light font-bold">5 pts/grupo</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-300">Un clasificado de grupo</span>
              <span className="text-blue-400 font-bold">2 pts/grupo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-card border border-white/10 rounded-xl p-1">
        <button
          onClick={() => setTab('podio')}
          className={cn(
            'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
            tab === 'podio' ? 'bg-field text-white' : 'text-gray-400'
          )}
        >
          🏆 Podio
        </button>
        <button
          onClick={() => setTab('grupos')}
          className={cn(
            'flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5',
            tab === 'grupos' ? 'bg-field text-white' : 'text-gray-400'
          )}
        >
          Fase de grupos
          <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{getGroupProgress()}%</span>
        </button>
      </div>

      {/* Podio tab */}
      {tab === 'podio' && (
        <div className="bg-surface-card border border-white/10 rounded-2xl p-5 space-y-4">
          {[
            { label: '🥇 Campeón del Mundo', value: champion, setter: setChampion, pts: 20, actual: actualPodio?.champion ?? null },
            { label: '🥈 Segundo clasificado', value: runnerUp, setter: setRunnerUp, pts: 10, actual: actualPodio?.runnerUp ?? null },
            { label: '🥉 Tercer clasificado', value: thirdPlace, setter: setThirdPlace, pts: 5, actual: actualPodio?.thirdPlace ?? null },
          ].map(({ label, value, setter, pts, actual }) => {
            const allActual = actualPodio ? [actualPodio.champion, actualPodio.runnerUp, actualPodio.thirdPlace] : null;
            const isExact = !!actualPodio && !!value && value === actual;
            const isInPodio = !!actualPodio && !!value && !isExact && (allActual?.includes(value) ?? false);
            const isWrong = !!actualPodio && !!value && !isExact && !isInPodio;
            return (
              <div key={label}>
                <label className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-white">{label}</span>
                  <div className="text-right">
                    <span className="text-xs text-crown font-bold">+{pts} pts exacto</span>
                    <span className="text-xs text-orange-400 font-bold ml-2">+3 en podio</span>
                  </div>
                </label>
                {locked ? (
                  <div className={cn(
                    'w-full rounded-xl px-4 py-3 text-sm flex items-center gap-2',
                    isExact   ? 'bg-green-500/15 border border-green-500/40 text-green-300'
                    : isInPodio ? 'bg-yellow-500/15 border border-yellow-500/40 text-yellow-300'
                    : isWrong   ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'bg-surface border border-white/10 text-gray-300'
                  )}>
                    {isExact    && <CheckCircle size={14} className="text-green-400 shrink-0" />}
                    {isInPodio  && <Trophy size={14} className="text-yellow-400 shrink-0" />}
                    {isWrong    && <X size={14} className="text-red-400 shrink-0" />}
                    {value || <span className="text-gray-600">Sin selección</span>}
                  </div>
                ) : (
                  <select
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                      focus:outline-none focus:border-field transition-colors text-sm appearance-none cursor-pointer"
                  >
                    <option value="">Selecciona un equipo...</option>
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Groups tab */}
      {tab === 'grupos' && (
        <div className="space-y-3">
          {Object.keys(teamsByGroup)
            .filter((g) => g !== 'Sin grupo')
            .sort()
            .map((groupName) => {
              const groupTeams = teamsByGroup[groupName];
              const pred = groupPreds[groupName] ?? ['', ''];

              return (
                <div key={groupName} className="bg-surface-card border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-white text-sm">Grupo {groupName}</h3>
                    {pred[0] && pred[1] ? (
                      <span className="text-xs text-field-light flex items-center gap-1">
                        <CheckCircle size={11} />
                        Completo
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">Incompleto</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] text-field-light font-semibold">+5 pts si aciertas ambos</span>
                    <span className="text-[10px] text-gray-500">·</span>
                    <span className="text-[10px] text-blue-400 font-semibold">+2 pts si aciertas uno</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((idx) => {
                      const pickedName = pred[idx as 0 | 1];
                      const qualifiers = groupQualifiers[groupName];
                      const hasResults = qualifiers && qualifiers.length > 0;
                      const isCorrect = hasResults && !!pickedName && qualifiers.includes(pickedName);
                      const isWrong = hasResults && !!pickedName && !qualifiers.includes(pickedName);
                      return (
                        <div key={idx}>
                          <label className="text-xs text-gray-500 mb-1 block">
                            {idx === 0 ? '1º clasificado' : '2º clasificado'}
                          </label>
                          {locked ? (
                            <div className={cn(
                              'w-full rounded-xl px-3 py-2.5 text-xs flex items-center gap-1.5',
                              isCorrect
                                ? 'bg-green-500/15 border border-green-500/40 text-green-300'
                                : isWrong
                                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                : 'bg-surface border border-white/10 text-gray-300'
                            )}>
                              {isCorrect && <CheckCircle size={11} className="text-green-400 shrink-0" />}
                              {isWrong && <X size={11} className="text-red-400 shrink-0" />}
                              {pickedName || <span className="text-gray-600">–</span>}
                            </div>
                          ) : (
                            <select
                              value={pred[idx as 0 | 1]}
                              onChange={(e) => setGroupTeam(groupName, idx as 0 | 1, e.target.value)}
                              className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2.5
                                text-white focus:outline-none focus:border-field text-xs appearance-none cursor-pointer"
                            >
                              <option value="">Elegir...</option>
                              {groupTeams.map((t) => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {Object.keys(teamsByGroup).filter((g) => g !== 'Sin grupo').length === 0 && (
            <div className="bg-surface-card border border-white/10 rounded-2xl p-8 text-center">
              <Shield size={32} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                Los grupos del Mundial 2026 aún no están disponibles.
                Se actualizarán automáticamente desde la API.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      {!locked && (
        <div className="sticky bottom-24 pt-2">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={cn(
              'w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg',
              saved
                ? 'bg-field-light/20 text-field-light'
                : 'bg-crown text-surface hover:bg-crown-muted disabled:opacity-50'
            )}
          >
            {saved ? (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle size={18} />
                ¡Predicciones guardadas!
              </span>
            ) : saving ? (
              'Guardando...'
            ) : hasSaved ? (
              'Actualizar predicciones'
            ) : (
              'Guardar todas las predicciones'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
