import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await rateLimit(`account-delete:${user.id}`, 3, 15 * 60 * 1000))) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera 15 minutos.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const password = body?.password ? String(body.password) : '';

  const isOAuthOnly = (user.identities ?? []).every((id) => id.provider !== 'email');

  if (!isOAuthOnly) {
    if (!password) {
      return NextResponse.json({ error: 'Se requiere la contraseña para eliminar la cuenta' }, { status: 400 });
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });
    if (authError) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 403 });
    }
  }

  const adminClient = createAdminClient();

  // Borra explícitamente los datos del usuario antes de eliminar la cuenta de auth.
  // Los cascades de Supabase podrían cubrir algunos de estos, pero push_subscriptions
  // y las predicciones contienen datos personales que deben eliminarse por cumplimiento del RGPD.
  await Promise.allSettled([
    adminClient.from('push_subscriptions').delete().eq('user_id', user.id),
    adminClient.from('match_predictions').delete().eq('user_id', user.id),
    adminClient.from('tournament_predictions').delete().eq('user_id', user.id),
    adminClient.from('xp_events').delete().eq('user_id', user.id),
    adminClient.from('points_log').delete().eq('user_id', user.id),
    adminClient.from('friendships').delete().or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    adminClient.from('group_members').delete().eq('user_id', user.id),
  ]);

  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) return NextResponse.json({ error: 'Error al eliminar la cuenta' }, { status: 500 });

  return NextResponse.json({ success: true });
}
