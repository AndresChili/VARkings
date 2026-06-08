'use client';

import Link from 'next/link';
import { VarkingsLogo, VarkingsWordmark } from '@/components/ui/varkings-logo';
import type { Profile } from '@/types';

interface TopBarProps {
  profile: Profile | null;
}

export function TopBar({ profile }: TopBarProps) {
  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-card/95 backdrop-blur-sm border-b border-white/10">
      <div className="flex items-center justify-between px-4 h-16 max-w-lg mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2">
          <VarkingsLogo size={32} />
          <VarkingsWordmark className="text-xl" />
        </Link>

        <Link href="/profile" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-field flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
        </Link>
      </div>
    </header>
  );
}
