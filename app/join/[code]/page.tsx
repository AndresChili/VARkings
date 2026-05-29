import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/register?invite=${code}`);
  }

  const { data: group } = await supabase
    .from('groups')
    .select('id, name')
    .eq('invite_code', code.toUpperCase())
    .single();

  if (!group) {
    redirect('/groups?error=invalid_code');
  }

  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
    });
  }

  redirect(`/groups/${group.id}`);
}
