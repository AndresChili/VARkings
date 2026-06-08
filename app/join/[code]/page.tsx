import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/register?invite=${encodeURIComponent(code)}`);
  }

  // Use admin client so invite_code lookup works regardless of RLS
  const admin = createAdminClient();
  const { data: group } = await admin
    .from('groups')
    .select('id, name, created_by')
    .eq('invite_code', code.toUpperCase())
    .single();

  if (!group) {
    redirect('/groups?error=invalid_code');
  }

  // Already a member → go straight to group
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    redirect(`/groups/${group.id}`);
  }

  // Creator rejoining → direct insert (shouldn't normally happen)
  if (group.created_by === user.id) {
    await admin.from('group_members').insert({ group_id: group.id, user_id: user.id });
    redirect(`/groups/${group.id}`);
  }

  // Check if there is already a pending request
  const { data: existingRequest } = await supabase
    .from('join_requests')
    .select('id, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingRequest?.status === 'pending') {
    redirect(`/groups?pending=${group.id}`);
  }

  // Delete previous rejected request if any
  if (existingRequest) {
    await supabase.from('join_requests').delete().eq('id', existingRequest.id);
  }

  // Create join request — admin must approve, not direct insert
  await supabase.from('join_requests').insert({
    group_id: group.id,
    user_id: user.id,
    status: 'pending',
  });

  redirect(`/groups?pending=${group.id}`);
}
