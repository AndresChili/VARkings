import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isTournamentLocked } from '@/lib/utils';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: group_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('group_tournament_predictions')
    .select('champion, runner_up, third_place')
    .eq('user_id', user.id)
    .eq('group_id', group_id)
    .maybeSingle();

  return NextResponse.json({ prediction: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: group_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isTournamentLocked()) {
    return NextResponse.json({ error: 'Predicciones cerradas' }, { status: 403 });
  }

  const { data: member } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: 'No eres miembro de este grupo' }, { status: 403 });

  const { data: existing } = await supabase
    .from('group_tournament_predictions')
    .select('id')
    .eq('user_id', user.id)
    .eq('group_id', group_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Ya tienes una predicción para este grupo. No se puede modificar.' }, { status: 403 });
  }

  const { champion, runner_up, third_place } = await req.json();

  const { error } = await supabase
    .from('group_tournament_predictions')
    .insert({ user_id: user.id, group_id, champion, runner_up, third_place });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
