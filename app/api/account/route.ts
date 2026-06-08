import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const password = body?.password ? String(body.password) : '';
  if (!password) {
    return NextResponse.json({ error: 'Se requiere la contraseña para eliminar la cuenta' }, { status: 400 });
  }

  // Re-verify password before irreversible deletion
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password,
  });
  if (authError) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) return NextResponse.json({ error: 'Error al eliminar la cuenta' }, { status: 500 });

  return NextResponse.json({ success: true });
}
