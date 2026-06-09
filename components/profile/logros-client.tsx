'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { AchievementsTab, type AchievementStats } from './achievements-tab';

export function LogrosClient({ stats, earnedIds }: { stats: AchievementStats; earnedIds: string[] }) {
  const router = useRouter();

  return (
    <div className="animate-fade-in max-w-lg mx-auto pb-4">
      {/* Header */}
      <div className="relative h-28 field-gradient overflow-hidden mb-0">
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
        <div className="absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-white/5" />
        <div className="absolute top-3 right-1/3 w-12 h-12 rounded-full bg-blue-500/10" />
        <div className="relative px-4 pt-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
            <span className="text-sm font-medium">Perfil</span>
          </button>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-xl">
              🏅
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-tight">Logros</h1>
              <p className="text-xs text-white/50">VARkings · Mundial 2026</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <AchievementsTab stats={stats} earnedIds={earnedIds} />
      </div>
    </div>
  );
}
