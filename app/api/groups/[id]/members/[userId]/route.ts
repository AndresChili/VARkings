import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }
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
    return NextResponse.json({ error: 'Solo el creador puede eliminar miembros' }, { status: 403 });
  }
  if (userId === user.id) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('group_members')
    .delete()
    .eq('group_id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
