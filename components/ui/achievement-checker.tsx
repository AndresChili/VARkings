'use client';

import { useEffect, useRef, useState } from 'react';
import { AchievementToast } from './achievement-toast';
import type { Achievement } from '@/lib/achievements';

const NOTIFIED_KEY = 'vk_notified_achievements';
const INIT_KEY = 'vk_achievements_initialized';
const COOLDOWN_MS = 10_000;

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

async function checkAchievements(
  lastCheckRef: React.MutableRefObject<number>,
  force: boolean,
  setToShow: React.Dispatch<React.SetStateAction<Achievement[]>>
) {
  const now = Date.now();
  if (!force && now - lastCheckRef.current < COOLDOWN_MS) return;
  lastCheckRef.current = now;

  try {
    const r = await fetch('/api/achievements/check');
    const data: { completed: Achievement[] } = await r.json();
    const completed = data.completed ?? [];
    const notified = getNotified();

    if (!localStorage.getItem(INIT_KEY)) {
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
  } catch {
    // silent
  }
}

export function AchievementChecker() {
  const [toShow, setToShow] = useState<Achievement[]>([]);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    // Initial check on mount
    checkAchievements(lastCheckRef, false, setToShow);

    // Immediate check when an action triggers it
    const handler = () => checkAchievements(lastCheckRef, true, setToShow);
    window.addEventListener('achievement-check', handler);
    return () => window.removeEventListener('achievement-check', handler);
  }, []);

  if (toShow.length === 0) return null;
  return <AchievementToast achievements={toShow} />;
}

/** Call after any action that could unlock an achievement */
export function triggerAchievementCheck() {
  window.dispatchEvent(new CustomEvent('achievement-check'));
}
