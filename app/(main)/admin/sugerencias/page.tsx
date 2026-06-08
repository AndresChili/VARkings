import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SuggestionsList, type SuggestionRow } from './suggestions-list';

export default async function SugerenciasAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    redirect('/profile');
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('suggestions')
    .select('id, subject, message, is_read, created_at, profiles(username, avatar_url)')
    .order('created_at', { ascending: false });

  return <SuggestionsList initial={(data ?? []) as SuggestionRow[]} />;
}
