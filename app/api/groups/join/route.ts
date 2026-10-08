import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { sendPushNotification } from '@/lib/push-notifications';

const INVITE_CODE_RE = /^[A-Z0-9]{4,16}$/;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await rateLimit(`group-join:${ip}`, 10, 5 * 60 * 1000))) {
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

  // Usa el cliente admin para saltarse RLS — búsqueda por código de invitación sin restricción
  const adminClient = createAdminClient();
  const { data: group } = await adminClient
    .from('groups')
    .select('id, name, created_by')
    .eq('invite_code', code)
    .single();

  if (!group) {
    return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 404 });
  }

  // Ya es miembro — responde antes de comprobar el límite
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ group, already_member: true });
  }

  // Aplica el límite de membresías solo para nuevas uniones
  const { count: membershipCount } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if ((membershipCount ?? 0) >= 20) {
    return NextResponse.json({ error: 'Límite alcanzado: máximo 20 grupos por usuario' }, { status: 400 });
  }

  // El creador se une directamente (no necesita aprobación)
  if (group.created_by === user.id) {
    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id });
    if (error) return NextResponse.json({ error: 'Error al unirse al grupo' }, { status: 500 });
    return NextResponse.json({ group, already_member: false, pending: false }, { status: 201 });
  }

  // Comprueba si ya existe una solicitud pendiente
  const { data: existingRequest } = await supabase
    .from('join_requests')
    .select('id, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingRequest?.status === 'pending') {
    return NextResponse.json({ group, pending: true, already_requested: true });
  }

  // Elimina la solicitud rechazada anterior y crea una nueva
  if (existingRequest) {
    await supabase.from('join_requests').delete().eq('id', existingRequest.id);
  }

  const { error } = await supabase
    .from('join_requests')
    .insert({ group_id: group.id, user_id: user.id, status: 'pending' });

  if (error) return NextResponse.json({ error: 'Error al enviar solicitud' }, { status: 500 });

  // Envía la notificación push al admin del grupo sin esperar respuesta
  ;(async () => {
    if (!group.created_by) return;
    const [{ data: profile }, admin] = [
      await supabase.from('profiles').select('username').eq('id', user.id).single(),
      adminClient,
    ];
    const { data: sub } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth_key').eq('user_id', group.created_by).maybeSingle();
    if (sub?.p256dh && sub?.auth_key) {
      await sendPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth_key: sub.auth_key }, {
        title: '🔔 Solicitud de entrada al grupo',
        body: `@${profile?.username ?? 'Alguien'} quiere unirse a "${group.name}"`,
        url: `/groups/${group.id}`,
      });
    }
  })().catch(() => {});

  return NextResponse.json({ group, pending: true }, { status: 201 });
}
