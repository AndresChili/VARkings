import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/register?invite=${encodeURIComponent(code)}`);
  }

  // Usa el cliente admin para que la búsqueda por invite_code funcione al margen de RLS
  const admin = createAdminClient();
  const { data: group } = await admin
    .from('groups')
    .select('id, name, created_by')
    .eq('invite_code', code.toUpperCase())
    .single();

  if (!group) {
    redirect('/groups?error=invalid_code');
  }

  // Ya es miembro → ir directo al grupo
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    redirect(`/groups/${group.id}`);
  }

  // El creador se reúne al grupo → inserción directa (no debería ocurrir normalmente)
  if (group.created_by === user.id) {
    await admin.from('group_members').insert({ group_id: group.id, user_id: user.id });
    redirect(`/groups/${group.id}`);
  }

  // Comprueba si ya existe una solicitud pendiente
  const { data: existingRequest } = await supabase
    .from('join_requests')
    .select('id, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingRequest?.status === 'pending') {
    redirect(`/groups?pending=${group.id}`);
  }

  // Elimina la solicitud rechazada anterior, si existe
  if (existingRequest) {
    await supabase.from('join_requests').delete().eq('id', existingRequest.id);
  }

  // Crea la solicitud de unión — el admin debe aprobarla, no se inserta directamente
  await supabase.from('join_requests').insert({
    group_id: group.id,
    user_id: user.id,
    status: 'pending',
  });

  redirect(`/groups?pending=${group.id}`);
}
