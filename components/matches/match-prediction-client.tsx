'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, CheckCircle, Lock } from 'lucide-react';
import Link from 'next/link';
import type { Match, MatchPrediction } from '@/types';
import {
  cn, formatMatchDateLong, isMatchStarted, getMatchStatusLabel,
  isMatchLive, isMatchFinished, getPointsColor
} from '@/lib/utils';
import { calculateMatchPoints } from '@/lib/scoring';
import { triggerAchievementCheck } from '@/components/ui/achievement-checker';
import { TEAM_NAME_ES } from '@/lib/teams';

const STAGE_ES: Record<string, string> = {
  'Round of 32': 'Dieciseisavos',
  'Round of 16': 'Octavos de Final',
  'Quarter-finals': 'Cuartos de Final',
  'Semi-finals': 'Semifinales',
  'Third Place': 'Tercer Puesto',
  'Final': 'Final',
};

interface MatchPredictionClientProps {
  match: Match;
  existingPrediction: MatchPrediction | null;
}

export function MatchPredictionClient({ match, existingPrediction }: MatchPredictionClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const started = isMatchStarted(match.match_date) || match.status !== 'NS';
  const live = isMatchLive(match.status);
  const done = isMatchFinished(match.status);

  const isKnockout = match.stage !== 'Group Stage';

  const homeNameEs = TEAM_NAME_ES[match.home_team_name ?? ''] ?? match.home_team_name ?? 'Local';
  const awayNameEs = TEAM_NAME_ES[match.away_team_name ?? ''] ?? match.away_team_name ?? 'Visitante';

  const [homeScore, setHomeScore] = useState(
    existingPrediction?.predicted_home_score?.toString() ?? ''
  );
  const [awayScore, setAwayScore] = useState(
    existingPrediction?.predicted_away_score?.toString() ?? ''
  );
  const [knockoutWinner, setKnockoutWinner] = useState<string | null>(
    existingPrediction?.predicted_winner ?? null
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');

  const preview =
    homeScore !== '' && awayScore !== '' && match.home_score != null && match.away_score != null
      ? calculateMatchPoints(+homeScore, +awayScore, match.home_score, match.away_score)
      : null;

  async function handleDelete() {
    if (started || deleting) return;
    setError('');
    setDeleting(true);

    const res = await fetch('/api/predictions/match', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: match.id }),
    });

    const data = await res.json();
    setDeleting(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setDeleted(true);
    setHomeScore('');
    setAwayScore('');
    startTransition(() => {
      router.push('/matches');
      router.refresh();
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (started) return;
    setError('');

    if (needsKnockoutWinner && !knockoutWinner) {
      setError('Debes elegir qué equipo pasa de ronda');
      return;
    }

    setSaving(true);

    const res = await fetch('/api/predictions/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: match.id,
        predicted_home_score: Number(homeScore),
        predicted_away_score: Number(awayScore),
        predicted_winner: needsKnockoutWinner ? knockoutWinner : null,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setSaved(true);
    triggerAchievementCheck();
    startTransition(() => {
      router.push('/matches');
      router.refresh();
    });
  }

  const scoresEntered = homeScore !== '' && awayScore !== '';
  const isDraw = scoresEntered && +homeScore === +awayScore;
  const needsKnockoutWinner = isKnockout && isDraw;

  const predictedWinner =
    scoresEntered
      ? +homeScore > +awayScore
        ? homeNameEs
        : +awayScore > +homeScore
        ? awayNameEs
        : needsKnockoutWinner
        ? null
        : 'Empate'
      : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-white">Predicción del partido</h1>
          <p className="text-xs text-gray-400">{STAGE_ES[match.stage] ?? match.stage}{match.group_name ? ` · Grupo ${match.group_name}` : ''}</p>
        </div>
      </div>

      {/* Match card */}
      <div className={cn(
        'rounded-2xl p-6 mb-5',
        live ? 'bg-green-500/10 border border-green-500/30' : 'bg-surface-card border border-white/10'
      )}>
        {live && (
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-sm font-bold">EN VIVO · {getMatchStatusLabel(match.status)}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex-1 text-center">
            {match.home_team_logo
              ? <img src={match.home_team_logo} alt={homeNameEs} className="w-14 h-14 object-contain mx-auto mb-2" />
              : <div className="w-14 h-14 rounded-full bg-white/5 mx-auto mb-2" />
            }
            <p className="font-bold text-white text-sm leading-tight">{match.home_team_name ? homeNameEs : 'Por determinar'}</p>
          </div>

          {/* Score */}
          <div className="text-center shrink-0">
            {done || live ? (
              <div className="text-3xl font-black text-white">
                {match.home_score ?? 0} — {match.away_score ?? 0}
              </div>
            ) : (
              <div className="text-gray-600 text-sm font-medium">vs</div>
            )}
            <div className="text-xs text-gray-500 mt-1">{formatMatchDateLong(match.match_date)}</div>
            {match.venue && <div className="text-xs text-gray-600 mt-0.5">{match.venue}</div>}
          </div>

          {/* Away team */}
          <div className="flex-1 text-center">
            {match.away_team_logo
              ? <img src={match.away_team_logo} alt={awayNameEs} className="w-14 h-14 object-contain mx-auto mb-2" />
              : <div className="w-14 h-14 rounded-full bg-white/5 mx-auto mb-2" />
            }
            <p className="font-bold text-white text-sm leading-tight">{match.away_team_name ? awayNameEs : 'Por determinar'}</p>
          </div>
        </div>
      </div>

      {/* Points result if calculated */}
      {existingPrediction?.is_calculated && (
        <div className="bg-surface-card border border-white/10 rounded-2xl p-5 mb-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Resultado de tu predicción</h3>
          <div className="text-center mb-3">
            <div className={cn('text-4xl font-black', getPointsColor(existingPrediction.points_total))}>
              +{existingPrediction.points_total}
            </div>
            <div className="text-gray-400 text-sm">puntos totales</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Ganador', pts: existingPrediction.points_winner },
              { label: `Goles ${homeNameEs.split(' ')[0]}`, pts: existingPrediction.points_home_score },
              { label: `Goles ${awayNameEs.split(' ')[0]}`, pts: existingPrediction.points_away_score },
            ].map(({ label, pts }) => (
              <div key={label} className="bg-surface rounded-xl p-3 text-center">
                <div className={cn('text-lg font-black', pts > 0 ? 'text-crown' : 'text-gray-600')}>
                  +{pts}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction form */}
      <div className="bg-surface-card border border-white/10 rounded-2xl p-5">
        {started ? (
          <div className="text-center py-4">
            <Lock size={28} className="text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400 font-medium">
              {live ? 'Partido en curso' : 'Partido finalizado'}
            </p>
            {existingPrediction ? (
              <p className="text-sm text-gray-500 mt-1">
                Tu predicción: {existingPrediction.predicted_home_score} - {existingPrediction.predicted_away_score}
                {existingPrediction.predicted_winner && (
                  <span className="text-gray-400"> · pasa {TEAM_NAME_ES[existingPrediction.predicted_winner] ?? existingPrediction.predicted_winner}</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-gray-600 mt-1">No hiciste ninguna predicción</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <h3 className="font-semibold text-white mb-1">Tu predicción</h3>
            <p className="text-xs text-gray-400 mb-5">¿Cuál será el resultado final?</p>

            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400 mb-2 leading-tight">{homeNameEs}</p>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  placeholder="0"
                  required
                  className="score-input mx-auto block"
                />
              </div>
              <div className="text-gray-500 font-bold text-xl shrink-0">–</div>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400 mb-2 leading-tight">{awayNameEs}</p>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  placeholder="0"
                  required
                  className="score-input mx-auto block"
                />
              </div>
            </div>

            {/* Predicted winner preview */}
            {predictedWinner && (
              <div className="bg-field/10 border border-field/30 rounded-xl px-4 py-2.5 mb-4 text-center">
                <p className="text-sm text-field-light">
                  Predices: <strong>{predictedWinner}</strong>
                </p>
              </div>
            )}

            {/* Knockout draw: pick who advances via penalties */}
            {needsKnockoutWinner && (
              <div className="mb-4">
                <p className="text-xs text-amber-400 text-center mb-2">
                  Empate — ¿quién pasa de ronda?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setKnockoutWinner(match.home_team_name ?? 'Local')}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors',
                      knockoutWinner === (match.home_team_name ?? 'Local')
                        ? 'bg-crown text-surface border-crown'
                        : 'bg-surface border-white/10 text-gray-300 hover:border-white/30'
                    )}
                  >
                    {homeNameEs}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKnockoutWinner(match.away_team_name ?? 'Visitante')}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors',
                      knockoutWinner === (match.away_team_name ?? 'Visitante')
                        ? 'bg-crown text-surface border-crown'
                        : 'bg-surface border-white/10 text-gray-300 hover:border-white/30'
                    )}
                  >
                    {awayNameEs}
                  </button>
                </div>
              </div>
            )}

            {/* Points breakdown info */}
            <div className="bg-surface rounded-xl p-3 mb-5 text-xs text-gray-500 space-y-1">
              <div className="flex justify-between"><span>Acertar ganador</span><span className="text-gray-300">+1 pt</span></div>
              <div className="flex justify-between"><span>Acertar goles locales</span><span className="text-gray-300">+1 pt</span></div>
              <div className="flex justify-between"><span>Acertar goles visitante</span><span className="text-gray-300">+1 pt</span></div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || saved}
              className={cn(
                'w-full py-3.5 rounded-xl font-bold text-sm transition-colors',
                saved
                  ? 'bg-field-light/20 text-field-light'
                  : 'bg-crown text-surface hover:bg-crown-muted disabled:opacity-50'
              )}
            >
              {saved ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle size={16} />
                  ¡Predicción guardada!
                </span>
              ) : saving ? (
                'Guardando...'
              ) : existingPrediction && !deleted ? (
                'Actualizar predicción'
              ) : (
                'Guardar predicción'
              )}
            </button>

            {existingPrediction && !deleted && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full mt-2 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Borrando...' : 'Eliminar predicción'}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
