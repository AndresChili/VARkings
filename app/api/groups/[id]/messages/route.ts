import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getMembership(supabase: Awaited<ReturnType<typeof createClient>>, groupId: string, userId: string) {
  const { data } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getMembership(supabase, groupId, user.id);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: messages, error } = await supabase
    .from('group_messages')
    .select('id, group_id, user_id, content, created_at, profiles(username, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: (messages ?? []).reverse() });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getMembership(supabase, groupId, user.id);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content || content.length > 500) {
    return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, user_id: user.id, content })
    .select('id, group_id, user_id, content, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
