'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Camera, CheckCircle, Target, Award } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import { cn } from '@/lib/utils';

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
    const { error } = await supabase
      .from('profiles')
      .update({ username: username.toLowerCase(), full_name: fullName } as { username: string; full_name: string })
      .eq('id', profile!.id);

    setSaving(false);
    if (error) { setError(error.message); return; }
    setSaved(true);
    setEditing(false);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  const accuracy = stats.calculatedPredictions > 0
    ? Math.round((stats.correctWinners / stats.calculatedPredictions) * 100)
    : 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-5 animate-fade-in">
      {/* Profile header */}
      <div className="bg-surface-card border border-white/10 rounded-2xl p-6 text-center">
        <div className="relative inline-block mb-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="w-20 h-20 rounded-full object-cover border-2 border-field"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-field to-field-dark
              flex items-center justify-center text-2xl font-black text-white border-2 border-field">
              {initials}
            </div>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-3 text-left">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre de usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                  focus:outline-none focus:border-field text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Opcional"
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white
                  focus:outline-none focus:border-field text-sm placeholder-gray-600"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-field text-white text-sm font-semibold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white">{profile?.username}</h1>
            {profile?.full_name && <p className="text-gray-400 text-sm mt-0.5">{profile.full_name}</p>}
            <p className="text-gray-600 text-xs mt-0.5">{email}</p>

            {saved && (
              <div className="flex items-center justify-center gap-1.5 mt-2 text-field-light text-sm">
                <CheckCircle size={14} />
                Perfil actualizado
              </div>
            )}

            <button
              onClick={() => setEditing(true)}
              className="mt-4 px-6 py-2 bg-surface border border-white/10 rounded-xl text-sm
                text-gray-300 hover:border-field/50 transition-colors"
            >
              Editar perfil
            </button>
          </>
        )}
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Mis estadísticas
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-card border border-white/10 rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-crown">{stats.matchPoints}</div>
            <div className="text-xs text-gray-400 mt-1">Puntos totales</div>
          </div>
          <div className="bg-surface-card border border-white/10 rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-field-light">{stats.totalPredictions}</div>
            <div className="text-xs text-gray-400 mt-1">Predicciones</div>
          </div>
          <div className="bg-surface-card border border-white/10 rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-blue-400">{stats.correctWinners}</div>
            <div className="text-xs text-gray-400 mt-1">Ganadores correctos</div>
          </div>
          <div className="bg-surface-card border border-white/10 rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-purple-400">{accuracy}%</div>
            <div className="text-xs text-gray-400 mt-1">Precisión</div>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
          border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-medium"
      >
        <LogOut size={18} />
        Cerrar sesión
      </button>
    </div>
  );
}
