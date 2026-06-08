import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const INVITE_CODE_RE = /^[A-Z0-9]{4,16}$/;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`group-join:${ip}`, 10, 5 * 60 * 1000)) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera 5 minutos.' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { invite_code } = await req.json();
  const code = typeof invite_code === 'string' ? invite_code.trim().toUpperCase() : '';
  if (!code || !INVITE_CODE_RE.test(code)) {
    return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 400 });
  }

  // Use admin client to bypass RLS — unauthenticated lookup by invite code
  const adminClient = createAdminClient();
  const { data: group } = await adminClient
    .from('groups')
    .select('id, name, created_by')
    .eq('invite_code', code)
    .single();

  if (!group) {
    return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 404 });
  }

  // Already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ group, already_member: true });
  }

  // Creator joins directly (no approval needed)
  if (group.created_by === user.id) {
    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id });
    if (error) return NextResponse.json({ error: 'Error al unirse al grupo' }, { status: 500 });
    return NextResponse.json({ group, already_member: false, pending: false }, { status: 201 });
  }

  // Check existing pending request
  const { data: existingRequest } = await supabase
    .from('join_requests')
    .select('id, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingRequest?.status === 'pending') {
    return NextResponse.json({ group, pending: true, already_requested: true });
  }

  // Delete previous rejected request then insert fresh
  if (existingRequest) {
    await supabase.from('join_requests').delete().eq('id', existingRequest.id);
  }

  const { error } = await supabase
    .from('join_requests')
    .insert({ group_id: group.id, user_id: user.id, status: 'pending' });

  if (error) return NextResponse.json({ error: 'Error al enviar solicitud' }, { status: 500 });

  return NextResponse.json({ group, pending: true }, { status: 201 });
}
