import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isTournamentLocked } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isTournamentLocked()) {
    return NextResponse.json({ error: 'Predicciones cerradas' }, { status: 403 });
  }

  const { group_predictions } = await req.json();

  const { data: existing } = await supabase
    .from('tournament_predictions')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('tournament_predictions')
      .update({ group_predictions })
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from('tournament_predictions')
      .insert({ user_id: user.id, group_predictions });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
