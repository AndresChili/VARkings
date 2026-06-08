import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

function isValidPushEndpoint(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:') return false;
    // Block SSRF: private/internal IP ranges and localhost
    if (
      hostname === 'localhost' ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === '0.0.0.0' ||
      /^169\.254\./.test(hostname) ||
      hostname === '::1' ||
      /^fc00:/i.test(hostname) ||
      /^fe80:/i.test(hostname)
    ) return false;
    return true;
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!rateLimit(`push-subscribe:${ip}`, 10, 5 * 60 * 1000)) {
    return NextResponse.json({ error: 'Demasiados intentos' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subscription } = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }
  const endpoint: string = subscription.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || !isValidPushEndpoint(endpoint)) {
    return NextResponse.json({ error: 'Invalid subscription endpoint' }, { status: 400 });
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh ?? null,
      auth_key: subscription.keys?.auth ?? null,
    }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: 'Error al guardar suscripción' }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase.from('push_subscriptions').delete().eq('user_id', user.id);

  return NextResponse.json({ success: true });
}
