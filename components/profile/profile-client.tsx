'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Target, Trophy, Zap, ChevronRight, CheckCircle, Edit3, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

interface ProfileClientProps {
  profile: Profile | null;
  stats: {
    totalPredictions: number;
    calculatedPredictions: number;
    matchPoints: number;
    correctWinners: number;
  };
  email: string;
}

function getLevel(points: number) {
  if (points >= 500) return { label: 'Leyenda', color: 'text-crown', bg: 'bg-crown/20', icon: '👑' };
  if (points >= 300) return { label: 'Experto', color: 'text-purple-400', bg: 'bg-purple-400/20', icon: '⚡' };
  if (points >= 150) return { label: 'Pro', color: 'text-blue-400', bg: 'bg-blue-400/20', icon: '🎯' };
  if (points >= 50) return { label: 'Amateur', color: 'text-field-light', bg: 'bg-field/20', icon: '⚽' };
  return { label: 'Novato', color: 'text-gray-400', bg: 'bg-gray-400/20', icon: '🌱' };
}

export function ProfileClient({ profile, stats, email }: ProfileClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const supabase = createClient();
  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??';
  const level = getLevel(stats.matchPoints);

  const accuracy = stats.calculatedPredictions > 0
    ? Math.round((stats.correctWinners / stats.calculatedPredictions) * 100)
    : 0;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (username.length < 3) { setError('Mínimo 3 caracteres'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Solo letras, números y _'); return; }

    setSaving(true);
    const { error: saveError } = await supabase
      .from('profiles')
      .update({ username: username.toLowerCase(), full_name: fullName } as { username: string; full_name: string })
      .eq('id', profile!.id);

    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setSaved(true);
    setEditing(false);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="animate-fade-in max-w-lg mx-auto">

      {/* Hero banner */}
      <div className="relative h-32 field-gradient overflow-hidden">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-8 w-36 h-36 rounded-full bg-white/5" />
        <div className="absolute top-3 right-1/3 w-16 h-16 rounded-full bg-crown/10" />
        <div className="absolute bottom-2 left-1/4 w-8 h-8 rounded-full bg-white/5" />
      </div>

      <div className="px-4">

        {/* Avatar row */}
        <div className="flex items-end justify-between -mt-12 mb-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-surface overflow-hidden shadow-xl shadow-black/50">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username ?? ''} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-field to-field-dark flex items-center justify-center text-2xl font-black text-white">
                  {initials}
                </div>
              )}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full ${level.bg} border-2 border-surface flex items-center justify-center text-sm`}>
              {level.icon}
            </div>
          </div>

          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 text-sm text-gray-300 hover:border-field/50 hover:text-white transition-all bg-surface-card mt-2"
            >
              <Edit3 size={13} />
              Editar
            </button>
          )}
        </div>

        {/* Identity */}
        {editing ? (
          <form onSubmit={handleSave} className="space-y-3 mb-6 bg-surface-card border border-white/10 rounded-2xl p-4">
            <p className="text-sm font-semibold text-white mb-1">Editar perfil</p>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Nombre de usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-field text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Nombre completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Opcional"
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-field text-sm placeholder-gray-600"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm flex items-center justify-center gap-1.5 hover:border-white/20 transition-colors"
              >
                <X size={13} />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-field text-white text-sm font-semibold disabled:opacity-50 hover:bg-field-muted transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-white">@{profile?.username}</h1>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${level.bg} ${level.color}`}>
                {level.label}
              </span>
              {saved && (
                <span className="flex items-center gap-1 text-field-light text-xs">
                  <CheckCircle size={12} />
                  Guardado
                </span>
              )}
            </div>
            {profile?.full_name && (
              <p className="text-gray-300 text-sm mt-0.5">{profile.full_name}</p>
            )}
            <p className="text-gray-500 text-xs mt-0.5">{email}</p>
          </div>
        )}

        {/* Stats grid */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Estadísticas</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-surface-card border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-crown/15 flex items-center justify-center">
                <Trophy size={15} className="text-crown" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Puntos</span>
            </div>
            <div className="text-3xl font-black text-crown tabular-nums">{stats.matchPoints}</div>
          </div>

          <div className="bg-surface-card border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-field/20 flex items-center justify-center">
                <Target size={15} className="text-field-light" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Predicciones</span>
            </div>
            <div className="text-3xl font-black text-field-light tabular-nums">{stats.totalPredictions}</div>
          </div>

          <div className="bg-surface-card border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <CheckCircle size={15} className="text-blue-400" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Aciertos</span>
            </div>
            <div className="text-3xl font-black text-blue-400 tabular-nums">{stats.correctWinners}</div>
          </div>

          <div className="bg-surface-card border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
                <Zap size={15} className="text-purple-400" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Precisión</span>
            </div>
            <div className="text-3xl font-black text-purple-400 tabular-nums">{accuracy}%</div>
          </div>
        </div>

        {/* Precision bar */}
        {stats.calculatedPredictions > 0 && (
          <div className="bg-surface-card border border-white/8 rounded-2xl p-4 mb-6">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-xs text-gray-400 font-medium">Aciertos totales</span>
              <span className="text-xs font-bold text-white">{stats.correctWinners} / {stats.calculatedPredictions}</span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-field to-field-light rounded-full transition-all duration-700"
                style={{ width: `${accuracy}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-gray-600">0%</span>
              <span className="text-xs font-semibold text-field-light">{accuracy}% precisión</span>
              <span className="text-xs text-gray-600">100%</span>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-red-500/20 text-red-400 hover:bg-red-500/8 transition-colors group mb-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center group-hover:bg-red-500/25 transition-colors">
              <LogOut size={15} />
            </div>
            <span className="font-medium text-sm">Cerrar sesión</span>
          </div>
          <ChevronRight size={16} className="text-red-500/40" />
        </button>

      </div>
    </div>
  );
}
