import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`register:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera 15 minutos.' }, { status: 429 });
  }

  const body = await req.json();
  const { email, password, username, fullName } = body ?? {};

  if (!email || !EMAIL_RE.test(String(email))) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }
  if (!password || String(password).length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }
  if (String(password).length > 128) {
    return NextResponse.json({ error: 'La contraseña no puede superar 128 caracteres' }, { status: 400 });
  }
  const pwd = String(password);
  if (!/[A-Z]/.test(pwd)) {
    return NextResponse.json({ error: 'La contraseña debe contener al menos una mayúscula' }, { status: 400 });
  }
  if (!/[0-9]/.test(pwd)) {
    return NextResponse.json({ error: 'La contraseña debe contener al menos un número' }, { status: 400 });
  }
  if (!username || !USERNAME_RE.test(String(username))) {
    return NextResponse.json({ error: 'Username: 3-20 caracteres, solo letras, números y _' }, { status: 400 });
  }
  if (!fullName || String(fullName).trim().length < 2) {
    return NextResponse.json({ error: 'Nombre completo requerido (mínimo 2 caracteres)' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: String(email).toLowerCase().trim(),
    password: String(password),
    email_confirm: true,
    user_metadata: {
      username: String(username).toLowerCase(),
      full_name: String(fullName).trim(),
    },
  });

  if (error) {
    return NextResponse.json({ error: 'Error al crear la cuenta. Inténtalo de nuevo.' }, { status: 400 });
  }

  return NextResponse.json({ id: data.user?.id }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
