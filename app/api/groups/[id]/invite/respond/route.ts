import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: group_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { invite_id, action } = await req.json() as { invite_id: string; action: 'accept' | 'reject' };

  const { data: invite } = await supabase
    .from('group_invites')
    .select('id, group_id, inviter_id')
    .eq('id', invite_id)
    .eq('invitee_id', user.id)
    .eq('status', 'pending')
    .single();
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

  if (action === 'accept') {
    // Create a join_request — admin must approve before joining group_members
    const { error: reqError } = await supabase
      .from('join_requests')
      .upsert(
        { group_id: invite.group_id, user_id: user.id, status: 'pending' },
        { onConflict: 'group_id,user_id', ignoreDuplicates: true }
      );
    if (reqError) return NextResponse.json({ error: reqError.message }, { status: 400 });
  }

  await supabase
    .from('group_invites')
    .update({ status: action === 'accept' ? 'accepted' : 'rejected' })
    .eq('id', invite_id);

  return NextResponse.json({ ok: true, action, pending: action === 'accept' });
}
