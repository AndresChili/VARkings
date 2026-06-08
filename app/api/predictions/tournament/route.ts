import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isTournamentLocked } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isTournamentLocked()) {
    return NextResponse.json(
      { error: 'El plazo para predicciones del torneo ha terminado' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { champion, runner_up, third_place, group_predictions } = body;

  const validateTeamName = (v: unknown) =>
    v === undefined || v === null || (typeof v === 'string' && v.trim().length > 0 && v.length <= 100);
  if (!validateTeamName(champion) || !validateTeamName(runner_up) || !validateTeamName(third_place)) {
    return NextResponse.json({ error: 'Nombre de equipo inválido' }, { status: 400 });
  }
  if (group_predictions !== undefined && group_predictions !== null) {
    if (typeof group_predictions !== 'object' || Array.isArray(group_predictions)) {
      return NextResponse.json({ error: 'Predicciones de grupos inválidas' }, { status: 400 });
    }
    const validGroups = new Set(['A','B','C','D','E','F','G','H','I','J','K','L']);
    for (const [key, val] of Object.entries(group_predictions as Record<string, unknown>)) {
      if (!validGroups.has(key)) return NextResponse.json({ error: 'Grupo inválido' }, { status: 400 });
      if (!Array.isArray(val) || val.length !== 2 || !val.every((v) => typeof v === 'string' && v.length > 0 && v.length <= 100)) {
        return NextResponse.json({ error: 'Predicción de grupo inválida' }, { status: 400 });
      }
    }
  }

  const { data: existing } = await supabase
    .from('tournament_predictions')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('tournament_predictions')
      .update({ champion, runner_up, third_place, group_predictions })
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, action: 'updated' });
  }

  const { error } = await supabase.from('tournament_predictions').insert({
    user_id: user.id,
    champion,
    runner_up,
    third_place,
    group_predictions: group_predictions ?? {},
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, action: 'created' }, { status: 201 });
}
