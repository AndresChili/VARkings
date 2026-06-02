import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { invite_code } = await req.json();
  if (!invite_code?.trim()) {
    return NextResponse.json({ error: 'Código de invitación requerido' }, { status: 400 });
  }

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, created_by')
    .eq('invite_code', invite_code.trim().toUpperCase())
    .single();

  if (!group) {
    return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 404 });
  }

  // Already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ group, already_member: true });
  }

  // Creator joins directly (no approval needed)
  if (group.created_by === user.id) {
    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ group, already_member: false, pending: false }, { status: 201 });
  }

  // Check existing pending request
  const { data: existingRequest } = await supabase
    .from('join_requests')
    .select('id, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingRequest?.status === 'pending') {
    return NextResponse.json({ group, pending: true, already_requested: true });
  }

  // Create join request (upsert in case of rejected)
  const { error } = await supabase
    .from('join_requests')
    .upsert({ group_id: group.id, user_id: user.id, status: 'pending' }, { onConflict: 'group_id,user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ group, pending: true }, { status: 201 });
}
