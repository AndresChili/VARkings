'use client';

import { useEffect, useRef, useState } from 'react';
import { AchievementToast, type ToastItem, type LevelUpItem } from './achievement-toast';
import type { Achievement } from '@/lib/achievements';

const NOTIFIED_KEY = 'vk_notified_achievements';
const INIT_KEY = 'vk_achievements_init';
const LEVEL_KEY = 'vk_known_level';
const COOLDOWN_MS = 10_000;

function getNotified(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveNotified(ids: Set<string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]));
}

async function runCheck(
  lastCheckRef: React.MutableRefObject<number>,
  force: boolean,
  setToShow: React.Dispatch<React.SetStateAction<ToastItem[]>>
) {
  const now = Date.now();
  if (!force && now - lastCheckRef.current < COOLDOWN_MS) return;
  lastCheckRef.current = now;

  try {
    const r = await fetch('/api/achievements/check');
    const data: { completed: Achievement[]; level?: number } = await r.json();
    const completed = data.completed ?? [];
    const currentLevel = data.level;

    const notified = getNotified();
    const initialized = !!localStorage.getItem(INIT_KEY);

    if (!initialized && !force) {
      completed.forEach((a) => notified.add(a.id));
      saveNotified(notified);
      localStorage.setItem(INIT_KEY, '1');
      if (currentLevel !== undefined) localStorage.setItem(LEVEL_KEY, String(currentLevel));
      return;
    }

    if (!initialized) localStorage.setItem(INIT_KEY, '1');

    const allNewItems: ToastItem[] = [];

    if (currentLevel !== undefined) {
      const storedLevel = parseInt(localStorage.getItem(LEVEL_KEY) ?? '0', 10);
      if (storedLevel > 0 && currentLevel > storedLevel) {
        for (let l = storedLevel + 1; l <= currentLevel; l++) {
          const item: LevelUpItem = { id: `levelup_${l}`, type: 'levelup', level: l };
          allNewItems.push(item);
        }
      }
      localStorage.setItem(LEVEL_KEY, String(currentLevel));
    }

    const newOnes = completed.filter((a) => !notified.has(a.id));

    if (newOnes.length > 0) {
      newOnes.forEach((a) => notified.add(a.id));
      saveNotified(notified);
      allNewItems.push(...newOnes);
    }

    if (allNewItems.length > 0) {
      setToShow(allNewItems);
    }
  } catch (e) {
    console.error('[achievements] error:', e);
  }
}

export function AchievementChecker() {
  const [toShow, setToShow] = useState<ToastItem[]>([]);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    runCheck(lastCheckRef, false, setToShow);
    const handler = () => {
      runCheck(lastCheckRef, true, setToShow);
    };
    window.addEventListener('achievement-check', handler);
    return () => window.removeEventListener('achievement-check', handler);
  }, []);

  if (toShow.length === 0) return null;
  return <AchievementToast items={toShow} />;
}

/** Llamar tras cualquier acción que pueda desbloquear un logro */
export function triggerAchievementCheck() {
  window.dispatchEvent(new CustomEvent('achievement-check'));
}
