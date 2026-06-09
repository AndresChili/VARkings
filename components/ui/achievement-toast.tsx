'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Achievement } from '@/lib/achievements';

export interface LevelUpItem {
  id: string;
  type: 'levelup';
  level: number;
}

export type ToastItem = Achievement | LevelUpItem;

function isLevelUp(item: ToastItem): item is LevelUpItem {
  return 'type' in item && (item as LevelUpItem).type === 'levelup';
}

export function AchievementToast({ items }: { items: ToastItem[] }) {
  const [queue, setQueue] = useState<ToastItem[]>(items);

  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => {
      setQueue((q) => q.slice(1));
    }, 3000);
    return () => clearTimeout(timer);
  }, [queue]);

  if (queue.length === 0) return null;

  const current = queue[0];
  const levelUp = isLevelUp(current);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div
        key={current.id}
        className={`rounded-2xl px-5 py-4 flex items-center gap-4 shadow-2xl w-80 animate-slide-down bg-surface-card border ${
          levelUp ? 'border-yellow-500/30' : 'border-white/10'
        }`}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
          levelUp ? 'bg-yellow-500/20' : 'bg-amber-500/20'
        }`}>
          {levelUp ? '⭐' : (current as Achievement).emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide leading-none mb-1.5 ${
            levelUp ? 'text-yellow-400' : 'text-amber-400'
          }`}>
            {levelUp ? '¡Subiste de nivel!' : '¡Logro desbloqueado!'}
          </p>
          <p className="text-base font-bold text-white leading-tight">
            {levelUp ? `Nivel ${(current as LevelUpItem).level}` : (current as Achievement).title}
          </p>
        </div>
        <button
          onClick={() => setQueue((q) => q.slice(1))}
          className="text-white/40 hover:text-white/80 transition-colors shrink-0 p-1"
        >
          <X size={16} />
        </button>
      </div>
      {queue.length > 1 && (
        <p className="text-center text-xs text-white/30 mt-1.5">+{queue.length - 1} más</p>
      )}
    </div>
  );
}
