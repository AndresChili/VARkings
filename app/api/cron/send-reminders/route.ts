import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendBulkPushNotifications } from '@/lib/push-notifications';

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

    // Busca los partidos de hoy (horario de verano en España = UTC+2, el cron corre a las 11:00 UTC = 13:00 en España)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    const { data: todayMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'NS')
      .gte('match_date', startOfDay.toISOString())
      .lt('match_date', endOfDay.toISOString());

    if (!todayMatches?.length) {
      return NextResponse.json({ success: true, sent: 0, reason: 'no matches today' });
    }

    const matchIds = todayMatches.map((m) => m.id);

    // Obtiene todas las suscripciones push
    const { data: allSubscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth_key')
      .limit(5000);

    if (!allSubscriptions?.length) {
      return NextResponse.json({ success: true, sent: 0, reason: 'no subscriptions' });
    }

    // Obtiene las predicciones ya hechas para los partidos de hoy
    const { data: predictions } = await supabase
      .from('match_predictions')
      .select('user_id, match_id')
      .in('match_id', matchIds);

    // Construye el mapa: user_id → conjunto de ids de partidos predichos
    const predsByUser: Record<string, Set<string>> = {};
    for (const p of predictions ?? []) {
      predsByUser[p.user_id] ??= new Set();
      predsByUser[p.user_id].add(p.match_id);
    }

    // Solo notifica a los usuarios a los que les falta al menos una predicción de hoy
    type ValidSub = { endpoint: string; p256dh: string; auth_key: string };
    const toNotify: ValidSub[] = allSubscriptions
      .filter((s) => {
        if (!s.p256dh || !s.auth_key) return false;
        const userPreds = predsByUser[s.user_id];
        return !userPreds || matchIds.some((id) => !userPreds.has(id));
      })
      .map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh!, auth_key: s.auth_key! }));

    if (!toNotify.length) {
      return NextResponse.json({ success: true, sent: 0, reason: 'all users predicted' });
    }

    const count = todayMatches.length;
    await sendBulkPushNotifications(toNotify, {
      title: '⚽ ¡Predice los partidos de hoy!',
      body: count === 1
        ? 'Hay 1 partido hoy. ¡No te quedes sin predecir!'
        : `Hay ${count} partidos hoy. ¡No te quedes sin predecir!`,
      url: '/matches',
    });

    return NextResponse.json({ success: true, sent: toNotify.length });
  } catch (error) {
    console.error('Reminder cron error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
