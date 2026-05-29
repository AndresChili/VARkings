import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TopBar } from '@/components/layout/top-bar';
import { PushPermissionBanner } from '@/components/ui/push-permission';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <TopBar profile={profile} />
      <PushPermissionBanner />
      <main className="flex-1 pb-20 pt-16">{children}</main>
      <BottomNav />
    </div>
  );
}
