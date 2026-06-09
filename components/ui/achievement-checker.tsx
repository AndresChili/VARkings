'use client';

import { useEffect, useState } from 'react';
import { AchievementToast } from './achievement-toast';
import type { Achievement } from '@/lib/achievements';

const SESSION_KEY = 'vk_achievements_checked';

export function AchievementChecker() {
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');

    fetch('/api/achievements/check')
      .then((r) => r.json())
      .then((data) => {
        if (data.newlyUnlocked?.length > 0) {
          setNewAchievements(data.newlyUnlocked);
        }
      })
      .catch(() => {});
  }, []);

  if (newAchievements.length === 0) return null;
  return <AchievementToast achievements={newAchievements} />;
}
