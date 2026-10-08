import { InstallPrompt } from '@/components/ui/install-prompt';
import { TournamentEndedBanner } from '@/components/ui/tournament-ended-banner';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center p-4">
      <div className="w-full max-w-sm mb-4 rounded-xl overflow-hidden">
        <TournamentEndedBanner />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        {children}
        <InstallPrompt />
      </div>
    </div>
  );
}
