'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Inicio' },
  { href: '/matches', icon: Calendar, label: 'Partidos' },
  { href: '/friends', icon: Users, label: 'Amigos' },
  { href: '/profile', icon: User, label: 'Perfil' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            prefetch={true}
            className={cn(
              'flex flex-col items-center gap-0.5 py-3 px-3 min-w-0 flex-1',
              'transition-colors duration-150',
              isActive ? 'text-crown' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            <Icon
              size={22}
              className={cn('transition-transform', isActive && 'scale-110')}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
