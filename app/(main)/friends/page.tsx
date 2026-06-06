import { createClient } from '@/lib/supabase/server';
import { FriendsClient } from '@/components/friends/friends-client';

export default async function FriendsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: friendships } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, created_at')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  const otherIds = [
    ...new Set(
      (friendships ?? []).map((f) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      )
    ),
  ];

  const { data: profiles } = otherIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', otherIds)
    : { data: [] };

  return (
    <FriendsClient
      currentUserId={user.id}
      friendships={friendships ?? []}
      profiles={profiles ?? []}
    />
  );
}
