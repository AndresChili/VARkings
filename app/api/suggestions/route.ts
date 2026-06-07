import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const message: string = body?.message ?? '';
  if (!message.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });
  if (message.trim().length > 1000) return NextResponse.json({ error: 'Máximo 1000 caracteres' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('suggestions')
    .insert({ user_id: user.id, message: message.trim() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
