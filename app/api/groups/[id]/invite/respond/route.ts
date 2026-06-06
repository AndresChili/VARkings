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
    const { data: group } = await supabase
      .from('groups')
      .select('created_by')
      .eq('id', invite.group_id)
      .single();

    const inviterIsAdmin = group?.created_by === invite.inviter_id;

    if (inviterIsAdmin) {
      // Admin invited → join directly
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({ group_id: invite.group_id, user_id: user.id });
      if (joinError && !joinError.message.includes('duplicate')) {
        return NextResponse.json({ error: joinError.message }, { status: 400 });
      }
      await supabase
        .from('group_invites')
        .update({ status: 'accepted' })
        .eq('id', invite_id);
      return NextResponse.json({ ok: true, action, pending: false });
    } else {
      // Non-admin invited → create join_request, admin must approve
      const { error: reqError } = await supabase
        .from('join_requests')
        .upsert(
          { group_id: invite.group_id, user_id: user.id, status: 'pending' },
          { onConflict: 'group_id,user_id', ignoreDuplicates: true }
        );
      if (reqError) return NextResponse.json({ error: reqError.message }, { status: 400 });
      await supabase
        .from('group_invites')
        .update({ status: 'accepted' })
        .eq('id', invite_id);
      return NextResponse.json({ ok: true, action, pending: true });
    }
  }

  await supabase
    .from('group_invites')
    .update({ status: 'rejected' })
    .eq('id', invite_id);

  return NextResponse.json({ ok: true, action, pending: false });
}
