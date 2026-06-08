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
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']);
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
    if (value && index < 7) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8);
    if (text.length === 8) {
      setOtp(text.split(''));
      inputRefs.current[7]?.focus();
    }
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
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
    if (token.length !== 8) {
      setOtpError('Introduce los 8 dígitos del código');
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
              Enviamos un código de 8 dígitos a{' '}
              <span className="text-white font-medium">{form.email}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div onPaste={handleOtpPaste} className="flex gap-1.5 justify-center">
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
                  className="w-9 h-11 text-center text-lg font-bold bg-surface border border-white/10
                    rounded-lg text-white focus:outline-none focus:border-crown transition-colors"
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
              disabled={otpLoading || otp.join('').length !== 8}
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
            onClick={() => { setRegistered(false); setOtp(['', '', '', '', '', '', '', '']); setOtpError(''); }}
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

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100
            text-gray-800 font-semibold py-3 rounded-xl transition-colors mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-gray-500 text-xs">o regístrate con email</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

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
