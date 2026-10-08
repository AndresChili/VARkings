'use client';

import Link from 'next/link';
import Image from 'next/image';
import { VarkingsLogo, VarkingsWordmark } from '@/components/ui/varkings-logo';
import { PwaInstallButton } from '@/components/ui/pwa-install-button';
import { isValidAvatarUrl } from '@/lib/avatar';
import type { Profile } from '@/types';

interface TopBarProps {
  profile: Profile | null;
  basePath?: string;
}

export function TopBar({ profile, basePath = '' }: TopBarProps) {
  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-card/95 backdrop-blur-sm border-b border-white/10">
      <div className="flex items-center justify-between px-4 h-16 max-w-lg mx-auto">
        <Link href={`${basePath}/dashboard`} className="flex items-center gap-2">
          <VarkingsLogo size={32} />
          <VarkingsWordmark className="text-xl" />
        </Link>

        <div className="flex items-center gap-2">
          <PwaInstallButton />
          <Link href={`${basePath}/profile`} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-field flex items-center justify-center text-xs font-bold text-white overflow-hidden">
              {isValidAvatarUrl(profile?.avatar_url) ? (
                <Image src={profile!.avatar_url!} alt={profile?.username ?? ''} width={32} height={32} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
