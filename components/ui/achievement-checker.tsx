'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AchievementToast } from './achievement-toast';
import type { Achievement } from '@/lib/achievements';

const NOTIFIED_KEY = 'vk_notified_achievements';
const INIT_KEY = 'vk_achievements_initialized';
const COOLDOWN_MS = 30_000;

function getNotified(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveNotified(set: Set<string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set]));
}

export function AchievementChecker() {
  const [toShow, setToShow] = useState<Achievement[]>([]);
  const lastCheckRef = useRef(0);
  const pathname = usePathname();

  useEffect(() => {
    const now = Date.now();
    if (now - lastCheckRef.current < COOLDOWN_MS) return;
    lastCheckRef.current = now;

    fetch('/api/achievements/check')
      .then((r) => r.json())
      .then((data: { completed: Achievement[] }) => {
        const completed = data.completed ?? [];
        const notified = getNotified();

        if (!localStorage.getItem(INIT_KEY)) {
          // First run: silently mark all existing as notified, no toasts
          completed.forEach((a) => notified.add(a.id));
          saveNotified(notified);
          localStorage.setItem(INIT_KEY, '1');
          return;
        }

        const newOnes = completed.filter((a) => !notified.has(a.id));
        if (newOnes.length > 0) {
          newOnes.forEach((a) => notified.add(a.id));
          saveNotified(notified);
          setToShow(newOnes);
        }
      })
      .catch(() => {});
  }, [pathname]);

  if (toShow.length === 0) return null;
  return <AchievementToast achievements={toShow} />;
}
