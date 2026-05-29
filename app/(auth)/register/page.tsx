'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { VarkingsLogo } from '@/components/ui/varkings-logo';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.username.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      setError('El nombre de usuario solo puede contener letras, números y _');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username.toLowerCase(),
          full_name: form.fullName,
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        setError('Este email ya está registrado');
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    setEmailSent(true);
    setLoading(false);
  }

  if (emailSent) {
    return (
      <div className="animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <VarkingsLogo size={80} />
          <h1 className="text-3xl font-bold text-white mt-4">VARkings</h1>
        </div>
        <div className="bg-surface-card border border-white/10 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="text-xl font-semibold text-white mb-2">Revisa tu email</h2>
          <p className="text-gray-400 text-sm">
            Enviamos un enlace de confirmación a{' '}
            <span className="text-white font-medium">{form.email}</span>.
            Haz clic en él para activar tu cuenta.
          </p>
        </div>
        <p className="text-center text-gray-400 mt-6 text-sm">
          ¿Ya confirmaste?{' '}
          <Link href="/login" className="text-crown hover:text-crown-light transition-colors font-medium">
            Iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col items-center mb-8">
        <VarkingsLogo size={80} />
        <h1 className="text-3xl font-bold text-white mt-4">VARkings</h1>
        <p className="text-gray-400 text-sm mt-1">Únete al torneo</p>
      </div>

      <div className="bg-surface-card border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Crear cuenta</h2>

        <form onSubmit={handleRegister} className="space-y-4">
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
                text-white placeholder-gray-600 focus:outline-none focus:border-field
                transition-colors"
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
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3
                text-white placeholder-gray-600 focus:outline-none focus:border-field
                transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
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
              name="password"
              value={form.password}
              onChange={handleChange}
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
            className="w-full bg-crown hover:bg-crown-muted disabled:opacity-50
              text-surface font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Creando cuenta...' : '¡Empezar a competir!'}
          </button>
        </form>
      </div>

      <p className="text-center text-gray-400 mt-6 text-sm">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-crown hover:text-crown-light transition-colors font-medium">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
