import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { awardXP } from '@/lib/xp-server';
import { XP_VALUES } from '@/lib/xp';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await rateLimit(`pred-match:${user.id}`, 30, 60_000))) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un momento.' }, { status: 429 });
  }

  const body = await req.json();
  const { match_id, predicted_home_score, predicted_away_score, predicted_winner } = body;

  if (match_id == null || predicted_home_score == null || predicted_away_score == null) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(String(match_id))) {
    return NextResponse.json({ error: 'match_id inválido' }, { status: 400 });
  }

  const home = Number(predicted_home_score);
  const away = Number(predicted_away_score);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 30 || away > 30) {
    return NextResponse.json({ error: 'Marcador inválido' }, { status: 400 });
  }

  // Verify match exists and hasn't started
  const { data: match } = await supabase
    .from('matches')
    .select('id, match_date, status, stage, home_team_name, away_team_name')
    .eq('id', match_id)
    .single();

  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  if (match.status !== 'NS' || new Date(match.match_date) <= new Date()) {
    return NextResponse.json({ error: 'El partido ya ha comenzado' }, { status: 403 });
  }

  const isKnockout = match.stage !== 'Group Stage';
  const isDraw = home === away;
  if (isKnockout && isDraw && !predicted_winner) {
    return NextResponse.json({ error: 'Debes elegir qué equipo pasa de ronda' }, { status: 400 });
  }
  const sanitizedWinner: string | null =
    isKnockout && isDraw ? (predicted_winner ?? null) : null;

  const { data: existing } = await supabase
    .from('match_predictions')
    .select('id')
    .eq('match_id', match_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('match_predictions')
      .update({ predicted_home_score: home, predicted_away_score: away, predicted_winner: sanitizedWinner })
      .eq('match_id', match_id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: 'Error al actualizar predicción' }, { status: 500 });
    return NextResponse.json({ success: true, action: 'updated' });
  }

  const { error } = await supabase.from('match_predictions').insert({
    user_id: user.id,
    match_id,
    predicted_home_score: home,
    predicted_away_score: away,
    predicted_winner: sanitizedWinner,
  });

  if (error) return NextResponse.json({ error: 'Error al guardar predicción' }, { status: 500 });

  // Award first-prediction XP (idempotent — ignored if already awarded)
  const admin = createAdminClient();
  await awardXP(admin, user.id, 'first_prediction', 'once', XP_VALUES.FIRST_PREDICTION);

  return NextResponse.json({ success: true, action: 'created' }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await rateLimit(`pred-match:${user.id}`, 30, 60_000))) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un momento.' }, { status: 429 });
  }

  const { match_id } = await req.json();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!match_id || !UUID_RE.test(String(match_id))) {
    return NextResponse.json({ error: 'match_id inválido' }, { status: 400 });
  }

  const { data: match } = await supabase
    .from('matches')
    .select('id, match_date, status')
    .eq('id', match_id)
    .single();

  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  if (match.status !== 'NS' || new Date(match.match_date) <= new Date()) {
    return NextResponse.json({ error: 'El partido ya ha comenzado' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('match_predictions')
    .delete()
    .eq('match_id', match_id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'Error al eliminar predicción' }, { status: 500 });
  return NextResponse.json({ success: true });
}
