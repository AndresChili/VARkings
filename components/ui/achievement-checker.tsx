'use client';

import { useEffect, useRef, useState } from 'react';
import { AchievementToast } from './achievement-toast';
import type { Achievement } from '@/lib/achievements';

const NOTIFIED_KEY = 'vk_notified_achievements';
const INIT_KEY = 'vk_achievements_init';
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
    const initialized = !!localStorage.getItem(INIT_KEY);

    if (!initialized && !force) {
      // First mount: silently mark all existing as seen, no toasts
      completed.forEach((a) => notified.add(a.id));
      saveNotified(notified);
      localStorage.setItem(INIT_KEY, '1');
      console.log('[achievements] initialized, existing count:', completed.length);
      return;
    }

    // Mark initialized if not yet (e.g. force=true before mount check returned)
    if (!initialized) localStorage.setItem(INIT_KEY, '1');

    const newOnes = completed.filter((a) => !notified.has(a.id));
    console.log('[achievements] completed:', completed.length, 'new:', newOnes.length);

    if (newOnes.length > 0) {
      newOnes.forEach((a) => notified.add(a.id));
      saveNotified(notified);
      setToShow(newOnes);
    }
  } catch (e) {
    console.error('[achievements] error:', e);
  }
}

export function AchievementChecker() {
  const [toShow, setToShow] = useState<Achievement[]>([]);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    console.log('[achievements] checker mounted');
    runCheck(lastCheckRef, false, setToShow);
    const handler = () => {
      console.log('[achievements] triggered');
      runCheck(lastCheckRef, true, setToShow);
    };
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
