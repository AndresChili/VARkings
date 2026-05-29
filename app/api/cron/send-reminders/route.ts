import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendBulkPushNotifications } from '@/lib/push-notifications';
import { addHours } from 'date-fns';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
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

      const predictedIds = predictedUsers?.map((p) => p.user_id) ?? [];

      let query = supabase.from('push_subscriptions').select('user_id, endpoint, p256dh, auth_key');
      if (predictedIds.length > 0) {
        query = query.not('user_id', 'in', `(${predictedIds.map((id) => `"${id}"`).join(',')})`);
      }
      const { data: subscriptions } = await query;

      if (!subscriptions?.length) continue;

      type ValidSub = { endpoint: string; p256dh: string; auth_key: string };
      const validSubs: ValidSub[] = subscriptions
        .filter((s) => s.p256dh && s.auth_key)
        .map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh!, auth_key: s.auth_key! }));

      await sendBulkPushNotifications(validSubs, {
        title: '⚽ ¡Partido en 1 hora!',
        body: `${match.home_team_name} vs ${match.away_team_name} - ¡Haz tu predicción!`,
        url: `/matches/${match.id}`,
      });

      totalSent += validSubs.length;
    }

    return NextResponse.json({ success: true, sent: totalSent });
  } catch (error) {
    console.error('Reminder cron error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
