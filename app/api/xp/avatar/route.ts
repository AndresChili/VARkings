import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { awardXP } from '@/lib/xp-server';
import { XP_VALUES } from '@/lib/xp';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verifica que el usuario realmente tenga avatar antes de otorgar XP
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single();

  if (!profile?.avatar_url) {
    return NextResponse.json({ awarded: false, reason: 'no_avatar' });
  }

  await awardXP(admin, user.id, 'avatar', 'once', XP_VALUES.PROFILE_AVATAR);

  return NextResponse.json({ awarded: true });
}
