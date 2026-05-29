import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { match_id, predicted_home_score, predicted_away_score } = body;

  if (match_id == null || predicted_home_score == null || predicted_away_score == null) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  // Verify match exists and hasn't started
  const { data: match } = await supabase
    .from('matches')
    .select('id, match_date, status')
    .eq('id', match_id)
    .single();

  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  if (match.status !== 'NS' || new Date(match.match_date) <= new Date()) {
    return NextResponse.json({ error: 'El partido ya ha comenzado' }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from('match_predictions')
    .select('id')
    .eq('match_id', match_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('match_predictions')
      .update({ predicted_home_score, predicted_away_score })
      .eq('match_id', match_id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, action: 'updated' });
  }

  const { error } = await supabase.from('match_predictions').insert({
    user_id: user.id,
    match_id,
    predicted_home_score,
    predicted_away_score,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, action: 'created' }, { status: 201 });
}
