'use client';

import { useState } from 'react';
import Link from 'next/link';
import { VarkingsLogo } from '@/components/ui/varkings-logo';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

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
    if (!/[A-Z]/.test(form.password)) {
      setError('La contraseña debe contener al menos una mayúscula');
      return;
    }
    if (!/[0-9]/.test(form.password)) {
      setError('La contraseña debe contener al menos un número');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        username: form.username,
        fullName: form.fullName,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.error?.includes('already registered') || data.error?.includes('already been registered')) {
        setError('Este email ya está registrado');
      } else {
        setError(data.error ?? 'Error al crear la cuenta');
      }
      setLoading(false);
      return;
    }

    setRegistered(true);
    setLoading(false);
  }

  if (registered) {
    return (
      <div className="animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <VarkingsLogo size={80} />
          <h1 className="text-3xl font-bold text-white mt-4">VARkings</h1>
        </div>
        <div className="bg-surface-card border border-white/10 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="text-xl font-semibold text-white mb-2">Confirma tu email</h2>
          <p className="text-gray-400 text-sm">
            Te enviamos un enlace de confirmación a <span className="text-white font-medium">{form.email}</span>.
            Revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta.
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
            {form.password.length > 0 && (
              <ul className="mt-2 space-y-1">
                {[
                  { ok: form.password.length >= 8, label: 'Mínimo 8 caracteres' },
                  { ok: /[A-Z]/.test(form.password), label: 'Una mayúscula' },
                  { ok: /[0-9]/.test(form.password), label: 'Un número' },
                ].map(({ ok, label }) => (
                  <li key={label} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-green-400' : 'text-gray-500'}`}>
                    <span className="text-base leading-none">{ok ? '✓' : '·'}</span>
                    {label}
                  </li>
                ))}
              </ul>
            )}
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
