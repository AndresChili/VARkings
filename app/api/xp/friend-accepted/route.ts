import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { awardFriendXP } from '@/lib/xp-server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { friendship_id } = await req.json();
  if (!friendship_id) return NextResponse.json({ error: 'Missing friendship_id' }, { status: 400 });

  const admin = createAdminClient();

  const { data: friendship } = await admin
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('id', friendship_id)
    .single();

  if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify current user is part of this friendship before awarding XP
  if (friendship.requester_id !== user.id && friendship.addressee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Award XP to both sides (idempotent)
  await Promise.all([
    awardFriendXP(admin, friendship.requester_id, friendship.addressee_id),
    awardFriendXP(admin, friendship.addressee_id, friendship.requester_id),
  ]);

  return NextResponse.json({ awarded: true });
}
