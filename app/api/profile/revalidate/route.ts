import { revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await rateLimit(`revalidate:${user.id}`, 10, 60_000))) {
    return Response.json({ error: 'Demasiados intentos' }, { status: 429 });
  }

  revalidateTag(`profile-${user.id}`);
  return Response.json({ ok: true });
}
