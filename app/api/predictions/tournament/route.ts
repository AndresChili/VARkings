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
