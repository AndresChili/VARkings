import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendBulkPushNotifications } from '@/lib/push-notifications';
import { addHours } from 'date-fns';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function verifyCronSecret(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const received = Buffer.from(header ?? '', 'utf8');
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  if (!verifyCronSecret(authHeader, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const now = new Date();
    const oneHourFromNow = addHours(now, 1);
    const twoHoursFromNow = addHours(now, 2);

    const { data: upcomingMatches } = await supabase
      .from('matches')
      .select('id, home_team_name, away_team_name, match_date')
      .eq('status', 'NS')
      .gte('match_date', oneHourFromNow.toISOString())
      .lte('match_date', twoHoursFromNow.toISOString());

    if (!upcomingMatches?.length) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    let totalSent = 0;

    for (const match of upcomingMatches) {
      const { data: predictedUsers } = await supabase
        .from('match_predictions')
        .select('user_id')
        .eq('match_id', match.id);

      const predictedIds = (predictedUsers?.map((p) => p.user_id) ?? []).filter((id) => UUID_RE.test(id));

      const { data: allSubscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh, auth_key')
        .limit(1000);
      const subscriptions = (allSubscriptions ?? []).filter(
        (s) => !predictedIds.includes(s.user_id)
      );

      if (!subscriptions?.length) continue;

      type ValidSub = { endpoint: string; p256dh: string; auth_key: string };
      const validSubs: ValidSub[] = subscriptions
        .filter((s) => s.p256dh && s.auth_key)
        .map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh!, auth_key: s.auth_key! }));

      const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 50);
      await sendBulkPushNotifications(validSubs, {
        title: '⚽ ¡Partido en 1 hora!',
        body: `${sanitize(match.home_team_name ?? 'Local')} vs ${sanitize(match.away_team_name ?? 'Visitante')} - ¡Haz tu predicción!`,
        url: `/matches/${match.id}`,
      });

      totalSent += validSubs.length;
    }

    return NextResponse.json({ success: true, sent: totalSent });
  } catch (error) {
    console.error('Reminder cron error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
