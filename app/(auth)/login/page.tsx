'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { VarkingsLogo } from '@/components/ui/varkings-logo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.');
      } else {
        setError('Email o contraseña incorrectos');
      }
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col items-center mb-8">
        <VarkingsLogo size={80} />
        <h1 className="text-3xl font-bold text-white mt-4">VARkings</h1>
        <p className="text-gray-400 text-sm mt-1">Quiniela Mundial 2026</p>
      </div>

      <div className="bg-surface-card border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Iniciar sesión</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3
                text-white placeholder-gray-600 focus:outline-none focus:border-field
                transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3
                text-white placeholder-gray-600 focus:outline-none focus:border-field
                transition-colors"
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
            className="w-full bg-field hover:bg-field-muted disabled:opacity-50
              text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>

      <p className="text-center text-gray-400 mt-6 text-sm">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="text-crown hover:text-crown-light transition-colors font-medium">
          Regístrate gratis
        </Link>
      </p>
    </div>
  );
}
