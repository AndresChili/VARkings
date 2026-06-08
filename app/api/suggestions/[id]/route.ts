import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard() {
  const superadminEmail = process.env.SUPERADMIN_EMAIL;
  if (!superadminEmail) {
    console.error('SUPERADMIN_EMAIL not configured');
    return null;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== superadminEmail.toLowerCase()) return null;
  return createAdminClient();
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await guard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const { error } = await admin.from('suggestions').update({ is_read: true }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await guard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const { error } = await admin.from('suggestions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
