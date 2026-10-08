import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateInviteCode } from '@/lib/utils';
import { awardXP } from '@/lib/xp-server';
import { XP_VALUES } from '@/lib/xp';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 5_000) {
    return NextResponse.json({ error: 'Payload demasiado grande' }, { status: 413 });
  }

  const body = await req.json();
  const { name, description } = body;

  // Limita los grupos creados por usuario
  const { count: createdCount } = await supabase
    .from('groups')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id);
  if ((createdCount ?? 0) >= 10) {
    return NextResponse.json({ error: 'Límite alcanzado: máximo 10 grupos creados por usuario' }, { status: 400 });
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  }
  if (name.trim().length > 50) {
    return NextResponse.json({ error: 'El nombre no puede superar 50 caracteres' }, { status: 400 });
  }
  if (description && description.trim().length > 300) {
    return NextResponse.json({ error: 'La descripción no puede superar 300 caracteres' }, { status: 400 });
  }

  const invite_code = generateInviteCode();

  const { data: group, error } = await supabase
    .from('groups')
    .insert({ name: name.trim(), description: description?.trim() ?? null, invite_code, created_by: user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Error al crear el grupo' }, { status: 500 });
  }

  // Une automáticamente al creador al grupo
  await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id });

  // Otorga XP por crear un grupo (1 vez por usuario)
  const admin = createAdminClient();
  await awardXP(admin, user.id, 'group_create', 'once', XP_VALUES.GROUP_CREATE);

  return NextResponse.json({ group }, { status: 201 });
}
