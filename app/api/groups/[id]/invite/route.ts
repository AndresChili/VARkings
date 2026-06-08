import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: group_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { invitee_id } = await req.json();
  if (!invitee_id || !UUID_RE.test(String(invitee_id))) {
    return NextResponse.json({ error: 'invitee_id inválido' }, { status: 400 });
  }

  // Verify invitee exists
  const { data: invitee } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', invitee_id)
    .maybeSingle();
  if (!invitee) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  // Any member can invite
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

  // Upsert: reset to pending if previously rejected
  const { data, error } = await supabase
    .from('group_invites')
    .upsert(
      { group_id, inviter_id: user.id, invitee_id, status: 'pending' },
      { onConflict: 'group_id,invitee_id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Error al enviar invitación' }, { status: 400 });

  return NextResponse.json({ ...data, group_name: group?.name });
}
