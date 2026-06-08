import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
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

  const adminClient = createAdminClient();

  if (group.created_by === user.id) {
    // Find oldest other member to transfer admin to
    const { data: nextAdmin } = await adminClient
      .from('group_members')
      .select('user_id')
      .eq('group_id', id)
      .neq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();

    if (!nextAdmin) {
      // No other members — delete the group entirely
      const { error } = await adminClient.from('groups').delete().eq('id', id);
      if (error) return NextResponse.json({ error: 'Error al eliminar el grupo' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Transfer admin
    const { error: transferError } = await adminClient
      .from('groups')
      .update({ created_by: nextAdmin.user_id })
      .eq('id', id);
    if (transferError) return NextResponse.json({ error: 'Error al transferir administración' }, { status: 500 });
  }

  const { error } = await adminClient
    .from('group_members')
    .delete()
    .eq('group_id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'Error al salir del grupo' }, { status: 500 });

  return NextResponse.json({ success: true });
}
