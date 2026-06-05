import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCachedUserProfile } from '@/lib/data-cache';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TopBar } from '@/components/layout/top-bar';
import { PushPermissionBanner } from '@/components/ui/push-permission';
import { InstallPrompt } from '@/components/ui/install-prompt';

async function TopBarWithProfile({ userId }: { userId: string }) {
  const profile = await getCachedUserProfile(userId);
  return <TopBar profile={profile} />;
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Suspense fallback={<TopBar profile={null} />}>
        <TopBarWithProfile userId={user.id} />
      </Suspense>
      <InstallPrompt />
      <PushPermissionBanner />
      <main className="flex-1 pb-20 pt-16">{children}</main>
      <BottomNav />
    </div>
  );
}
