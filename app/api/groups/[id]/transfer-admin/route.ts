import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { new_admin_id } = await req.json();

  if (!new_admin_id) return NextResponse.json({ error: 'new_admin_id requerido' }, { status: 400 });

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
    return NextResponse.json({ error: 'Solo el admin puede transferir el rol' }, { status: 403 });
  }
  if (new_admin_id === user.id) {
    return NextResponse.json({ error: 'Ya eres el admin' }, { status: 400 });
  }

  // Verify target is a member
  const adminClient = createAdminClient();
  const { data: member } = await adminClient
    .from('group_members')
    .select('user_id')
    .eq('group_id', id)
    .eq('user_id', new_admin_id)
    .single();

  if (!member) return NextResponse.json({ error: 'El usuario no es miembro del grupo' }, { status: 400 });

  const { error } = await adminClient
    .from('groups')
    .update({ created_by: new_admin_id })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
