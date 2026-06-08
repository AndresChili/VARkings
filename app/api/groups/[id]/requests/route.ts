import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { awardGroupJoinXP, checkGroupMilestonesXP } from '@/lib/xp-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: group } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', id)
    .single();

  if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
  if (group.created_by !== user.id) {
    return NextResponse.json({ error: 'Solo el creador puede ver solicitudes' }, { status: 403 });
  }

  const { data: requests } = await supabase
    .from('join_requests')
    .select('id, user_id, created_at')
    .eq('group_id', id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);

  const userIds = (requests ?? []).map((r) => r.user_id);
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, username').in('id', userIds)
    : { data: [] };

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.username]));
  const result = (requests ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    username: profileMap[r.user_id] ?? 'Usuario',
    created_at: r.created_at,
  }));

  return NextResponse.json({ requests: result });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: group } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', id)
    .single();

  if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
  if (group.created_by !== user.id) {
    return NextResponse.json({ error: 'Solo el creador puede gestionar solicitudes' }, { status: 403 });
  }

  const { user_id, action } = await req.json();
  if (!user_id || !UUID_RE.test(String(user_id)) || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  if (action === 'accept') {
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: id, user_id });

    if (memberError && memberError.code !== '23505') {
      return NextResponse.json({ error: 'Error al añadir miembro' }, { status: 500 });
    }

    // Award XP to joining user + check 5-member milestone for creator
    const admin = createAdminClient();
    await Promise.all([
      awardGroupJoinXP(admin, user_id, id),
      checkGroupMilestonesXP(admin, id, user.id),
    ]);
  }

  const { error } = await supabase
    .from('join_requests')
    .update({ status: action === 'accept' ? 'accepted' : 'rejected' })
    .eq('group_id', id)
    .eq('user_id', user_id);

  if (error) return NextResponse.json({ error: 'Error al procesar solicitud' }, { status: 500 });

  return NextResponse.json({ success: true });
}
