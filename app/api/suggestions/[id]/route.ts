import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard(req: NextRequest) {
  const superadminEmail = process.env.SUPERADMIN_EMAIL;
  if (!superadminEmail) {
    console.error('SUPERADMIN_EMAIL not configured');
    return null;
  }
  const ip = getClientIp(req);
  if (!(await rateLimit(`admin-suggestions:${ip}`, 30, 5 * 60 * 1000))) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== superadminEmail.toLowerCase()) return null;
  return createAdminClient();
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await guard(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const { error } = await admin.from('suggestions').update({ is_read: true }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await guard(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const { error } = await admin.from('suggestions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
