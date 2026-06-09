'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Achievement } from '@/lib/achievements';

export function AchievementToast({ achievements }: { achievements: Achievement[] }) {
  const [queue, setQueue] = useState<Achievement[]>(achievements);

  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => {
      setQueue((q) => q.slice(1));
    }, 1500);
    return () => clearTimeout(timer);
  }, [queue]);

  if (queue.length === 0) return null;

  const current = queue[0];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div
        key={current.id}
        className="bg-surface-card border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl w-72 animate-slide-down"
      >
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl shrink-0">
          {current.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide leading-none mb-1">
            ¡Logro desbloqueado!
          </p>
          <p className="text-sm font-bold text-white leading-tight">{current.title}</p>
        </div>
        <button
          onClick={() => setQueue((q) => q.slice(1))}
          className="text-white/40 hover:text-white/80 transition-colors shrink-0 p-1"
        >
          <X size={14} />
        </button>
      </div>
      {queue.length > 1 && (
        <p className="text-center text-xs text-white/30 mt-1.5">+{queue.length - 1} más</p>
      )}
    </div>
  );
}
