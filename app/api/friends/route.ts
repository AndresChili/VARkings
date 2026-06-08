import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await rateLimit(`friends-send:${ip}`, 20, 5 * 60 * 1000))) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera 5 minutos.' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { addressee_id } = body ?? {};

  if (!addressee_id || !UUID_RE.test(String(addressee_id))) {
    return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
  }
  if (String(addressee_id) === user.id) {
    return NextResponse.json({ error: 'No puedes añadirte a ti mismo' }, { status: 400 });
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', addressee_id)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: String(addressee_id), status: 'pending' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'No se pudo enviar la solicitud' }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await rateLimit(`friends-accept:${user.id}`, 30, 60_000))) {
    return NextResponse.json({ error: 'Demasiados intentos' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { friendship_id } = body ?? {};

  if (!friendship_id || !UUID_RE.test(String(friendship_id))) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user is the addressee of this pending friendship
  const { data: existing } = await admin
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('id', String(friendship_id))
    .eq('addressee_id', user.id)
    .eq('status', 'pending')
    .single();

  if (!existing) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

  const { data, error } = await admin
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', String(friendship_id))
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: 'Error al aceptar solicitud' }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { friendship_id } = body ?? {};

  if (!friendship_id || !UUID_RE.test(String(friendship_id))) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', String(friendship_id))
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) return NextResponse.json({ error: 'Error al cancelar solicitud' }, { status: 500 });
  return NextResponse.json({ success: true });
}
