import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isKnockoutStarted } from '@/lib/utils';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: group_id } = await params;
  if (!UUID_RE.test(group_id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
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
  if (!UUID_RE.test(group_id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isKnockoutStarted()) {
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

  const validateTeamName = (v: unknown) =>
    typeof v === 'string' && v.trim().length > 0 && v.length <= 100;
  if (!validateTeamName(champion) || !validateTeamName(runner_up) || !validateTeamName(third_place)) {
    return NextResponse.json({ error: 'Nombre de equipo inválido' }, { status: 400 });
  }

  const { error } = await supabase
    .from('group_tournament_predictions')
    .insert({ user_id: user.id, group_id, champion, runner_up, third_place });

  if (error) return NextResponse.json({ error: 'Error al guardar predicción' }, { status: 500 });
  return NextResponse.json({ success: true });
}
