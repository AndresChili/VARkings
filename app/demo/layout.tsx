import { TopBar } from '@/components/layout/top-bar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TournamentEndedBanner } from '@/components/ui/tournament-ended-banner';
import { DemoNetworkGuard } from '@/components/demo/demo-network-guard';
import { DEMO_PROFILE } from '@/lib/demo/demo-data';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-surface pt-16">
      <TopBar profile={DEMO_PROFILE} basePath="/demo" />
      <div className="bg-crown/15 border-b border-crown/30 px-4 py-2 text-center">
        <p className="text-xs sm:text-sm text-crown-light">
          Estás viendo una demo con datos de ejemplo — no hace falta registrarte
        </p>
      </div>
      <TournamentEndedBanner />
      <DemoNetworkGuard />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav basePath="/demo" />
    </div>
  );
}
