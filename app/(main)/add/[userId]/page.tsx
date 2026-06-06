import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AddFriendClient } from '@/components/friends/add-friend-client';

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function AddFriendPage({ params }: Props) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (userId === user.id) notFound();

  const [{ data: target }, { data: friendship }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', userId)
      .single(),
    supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`
      )
      .maybeSingle(),
  ]);

  if (!target) notFound();

  return (
    <AddFriendClient
      currentUserId={user.id}
      target={target}
      existingFriendship={friendship ?? null}
    />
  );
}
