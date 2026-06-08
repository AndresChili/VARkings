import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { awardXP } from '@/lib/xp-server';
import { XP_VALUES } from '@/lib/xp';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!rateLimit(`xp-share:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Demasiados intentos' }, { status: 429 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Count existing share events
  const { count } = await admin
    .from('xp_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('source_type', 'app_share');

  const existing = count ?? 0;
  if (existing >= 3) {
    return NextResponse.json({ awarded: false, reason: 'max_reached' });
  }

  const shareNum = existing + 1;
  await awardXP(admin, user.id, 'app_share', String(shareNum), XP_VALUES.APP_SHARE);

  return NextResponse.json({ awarded: true, shareCount: shareNum });
}
