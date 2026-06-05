import { InstallPrompt } from '@/components/ui/install-prompt';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {children}
        <InstallPrompt />
      </div>
    </div>
  );
}
