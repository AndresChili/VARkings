import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: group_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { invitee_id } = await req.json();
  if (!invitee_id) return NextResponse.json({ error: 'invitee_id required' }, { status: 400 });

  // Only group creator (admin) can invite
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, created_by')
    .eq('id', group_id)
    .single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  if (group.created_by !== user.id) return NextResponse.json({ error: 'Only the group admin can invite' }, { status: 403 });

  // Upsert: reset to pending if previously rejected
  const { data, error } = await supabase
    .from('group_invites')
    .upsert(
      { group_id, inviter_id: user.id, invitee_id, status: 'pending' },
      { onConflict: 'group_id,invitee_id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(data);
}
