'use client';

import { useEffect, useRef, useState } from 'react';
import { AchievementToast } from './achievement-toast';
import type { Achievement } from '@/lib/achievements';

const NOTIFIED_KEY = 'vk_notified_achievements';
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
    const data: { recentlyUnlocked: Achievement[] } = await r.json();
    const recent = data.recentlyUnlocked ?? [];
    if (recent.length === 0) return;

    const notified = getNotified();
    const newOnes = recent.filter((a) => !notified.has(a.id));
    if (newOnes.length === 0) return;

    newOnes.forEach((a) => notified.add(a.id));
    saveNotified(notified);
    setToShow(newOnes);
  } catch {
    // silent
  }
}

export function AchievementChecker() {
  const [toShow, setToShow] = useState<Achievement[]>([]);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    runCheck(lastCheckRef, false, setToShow);
    const handler = () => runCheck(lastCheckRef, true, setToShow);
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
