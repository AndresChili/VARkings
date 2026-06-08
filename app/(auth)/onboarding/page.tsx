'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { VarkingsLogo } from '@/components/ui/varkings-logo';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', fullName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!USERNAME_RE.test(form.username)) {
      setError('Username: 3-20 caracteres, solo letras, números y _');
      return;
    }
    if (form.fullName.trim().length < 2) {
      setError('Nombre completo requerido (mínimo 2 caracteres)');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        username: form.username.toLowerCase(),
        full_name: form.fullName.trim(),
        avatar_url: null,
      } as { username: string; full_name: string; avatar_url: null })
      .eq('id', user.id);

    if (dbError) {
      if (dbError.message?.includes('unique') || dbError.message?.includes('duplicate')) {
        setError('Ese nombre de usuario ya está en uso');
      } else {
        setError('Error al guardar. Inténtalo de nuevo.');
      }
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col items-center mb-8">
        <VarkingsLogo size={80} />
        <h1 className="text-3xl font-bold text-white mt-4">VARkings</h1>
        <p className="text-gray-400 text-sm mt-1">Un paso más para competir</p>
      </div>

      <div className="bg-surface-card border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-2">Completa tu perfil</h2>
        <p className="text-gray-400 text-sm mb-6">Elige tu nombre de usuario para aparecer en el ranking.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Nombre de usuario</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="vikingo_fc"
              required
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3
                text-white placeholder-gray-600 focus:outline-none focus:border-field transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Nombre completo</label>
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Olaf Erikson"
              required
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3
                text-white placeholder-gray-600 focus:outline-none focus:border-field transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-crown hover:bg-crown-muted disabled:opacity-50
              text-surface font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Guardando...' : '¡Entrar al torneo!'}
          </button>
        </form>
      </div>
    </div>
  );
}
