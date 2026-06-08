'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { VarkingsLogo } from '@/components/ui/varkings-logo';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      inputRefs.current[5]?.focus();
    }
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

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError('');
    const token = otp.join('');
    if (token.length !== 6) {
      setOtpError('Introduce los 6 dígitos del código');
      return;
    }

    setOtpLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: form.email,
      token,
      type: 'signup',
    });

    if (error) {
      setOtpError('Código incorrecto o expirado. Revisa tu email.');
      setOtpLoading(false);
      return;
    }

    window.location.href = '/dashboard';
  }

  if (registered) {
    return (
      <div className="animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <VarkingsLogo size={80} />
          <h1 className="text-3xl font-bold text-white mt-4">VARkings</h1>
          <p className="text-gray-400 text-sm mt-1">Verifica tu cuenta</p>
        </div>

        <div className="bg-surface-card border border-white/10 rounded-2xl p-6">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">📧</div>
            <h2 className="text-xl font-semibold text-white mb-1">Introduce tu código</h2>
            <p className="text-gray-400 text-sm">
              Enviamos un código de 6 dígitos a{' '}
              <span className="text-white font-medium">{form.email}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div onPaste={handleOtpPaste} className="flex gap-2 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-11 h-14 text-center text-xl font-bold bg-surface border border-white/10
                    rounded-xl text-white focus:outline-none focus:border-crown transition-colors"
                />
              ))}
            </div>

            {otpError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm text-center">{otpError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={otpLoading || otp.join('').length !== 6}
              className="w-full bg-crown hover:bg-crown-muted disabled:opacity-50
                text-surface font-bold py-3 rounded-xl transition-colors"
            >
              {otpLoading ? 'Verificando...' : 'Verificar y entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 mt-6 text-sm">
          ¿No recibiste el código?{' '}
          <button
            onClick={() => { setRegistered(false); setOtp(['', '', '', '', '', '']); setOtpError(''); }}
            className="text-crown hover:text-crown-light transition-colors font-medium"
          >
            Volver atrás
          </button>
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
