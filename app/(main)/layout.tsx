import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getCachedUserProfile } from '@/lib/data-cache';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TopBar } from '@/components/layout/top-bar';
import { PushPermissionBanner } from '@/components/ui/push-permission';
import { InstallPrompt } from '@/components/ui/install-prompt';
import { recordDailyLogin } from '@/lib/xp-server';

async function TopBarWithProfile({ userId }: { userId: string }) {
  const profile = await getCachedUserProfile(userId);
  return <TopBar profile={profile} />;
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const admin = createAdminClient();
  recordDailyLogin(admin, user.id); // fire-and-forget, idempotent

  return (
    <div className="flex flex-col min-h-screen bg-surface pt-16">
      <Suspense fallback={<TopBar profile={null} />}>
        <TopBarWithProfile userId={user.id} />
      </Suspense>
      <InstallPrompt />
      <PushPermissionBanner />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
