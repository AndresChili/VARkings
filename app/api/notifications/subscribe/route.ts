import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subscription } = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }
  const endpoint: string = subscription.endpoint;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 2048) {
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase.from('push_subscriptions').delete().eq('user_id', user.id);

  return NextResponse.json({ success: true });
}
