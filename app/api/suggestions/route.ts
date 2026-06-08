import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const subject: string = body?.subject ?? '';
  const message: string = body?.message ?? '';
  if (!subject.trim()) return NextResponse.json({ error: 'El asunto es obligatorio' }, { status: 400 });
  if (subject.trim().length > 100) return NextResponse.json({ error: 'Asunto máximo 100 caracteres' }, { status: 400 });
  if (!message.trim()) return NextResponse.json({ error: 'El mensaje es obligatorio' }, { status: 400 });
  if (message.trim().length > 1000) return NextResponse.json({ error: 'Mensaje máximo 1000 caracteres' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('suggestions')
    .insert({ user_id: user.id, subject: subject.trim(), message: message.trim() });

  if (error) return NextResponse.json({ error: 'Error al enviar sugerencia' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
