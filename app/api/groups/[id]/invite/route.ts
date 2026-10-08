import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { sendPushNotification } from '@/lib/push-notifications';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: group_id } = await params;
  if (!UUID_RE.test(group_id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await rateLimit(`group-invite:${user.id}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un momento.' }, { status: 429 });
  }

  const { invitee_id } = await req.json();
  if (!invitee_id || !UUID_RE.test(String(invitee_id))) {
    return NextResponse.json({ error: 'invitee_id inválido' }, { status: 400 });
  }

  // Verifica que el invitado exista
  const { data: invitee } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', invitee_id)
    .maybeSingle();
  if (!invitee) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  // Cualquier miembro puede invitar
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group_id)
    .eq('user_id', user.id)
    .single();
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const { data: group } = await supabase
    .from('groups')
    .select('name')
    .eq('id', group_id)
    .single();

  // Upsert: vuelve a pending si se había rechazado antes
  const { data, error } = await supabase
    .from('group_invites')
    .upsert(
      { group_id, inviter_id: user.id, invitee_id, status: 'pending' },
      { onConflict: 'group_id,invitee_id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Error al enviar invitación' }, { status: 400 });

  // Envía la notificación push al invitado sin esperar respuesta
  ;(async () => {
    const [{ data: profile }, admin] = [
      await supabase.from('profiles').select('username').eq('id', user.id).single(),
      createAdminClient(),
    ];
    const { data: sub } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth_key').eq('user_id', String(invitee_id)).maybeSingle();
    if (sub?.p256dh && sub?.auth_key) {
      await sendPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth_key: sub.auth_key }, {
        title: '👥 Invitación a grupo',
        body: `@${profile?.username ?? 'Alguien'} te ha invitado al grupo "${group?.name ?? ''}"`,
        url: '/dashboard',
      });
    }
  })().catch(() => {});

  return NextResponse.json({ ...data, group_name: group?.name });
}
