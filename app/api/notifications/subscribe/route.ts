import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// Allowlist of known web push service domains (Chrome/FCM, Firefox, Safari, Edge)
const PUSH_DOMAIN_ALLOWLIST = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
  'notify.windows.com',
  'wns.notify.windows.com',
  'sg2p.notify.windows.com',
];

function isValidPushEndpoint(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:') return false;
    // Reject raw IP addresses (decimal, IPv6) — real push services use hostnames
    if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return false;
    // Require hostname matches a known push provider
    return PUSH_DOMAIN_ALLOWLIST.some(
      (d) => hostname === d || hostname.endsWith('.' + d)
    );
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
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
