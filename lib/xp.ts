// XP thresholds[i] = total XP needed to reach level i+1
// Level 1 = 0 XP, Level 20 = 2830 XP (max theoretical ~3495)
export const LEVEL_THRESHOLDS = [
  0,    // L1
  30,   // L2
  70,   // L3
  120,  // L4
  180,  // L5
  250,  // L6
  330,  // L7
  420,  // L8
  520,  // L9
  630,  // L10
  760,  // L11
  910,  // L12
  1080, // L13
  1270, // L14
  1480, // L15
  1710, // L16
  1960, // L17
  2230, // L18
  2520, // L19
  2830, // L20
] as const;

export const XP_VALUES = {
  MATCH_MULTIPLIER: 5,      // points_total × 5 for calculated predictions
  FIRST_PREDICTION: 10,
  ALL_GROUP_STAGE: 30,
  ALL_TOURNAMENT: 75,
  CHAMPION_CORRECT: 150,
  RUNNER_UP_CORRECT: 80,
  THIRD_PLACE_CORRECT: 50,
  FULL_PODIUM_BONUS: 200,
  GROUP_CREATE: 20,
  GROUP_JOIN: 10,
  GROUP_MILESTONE_5: 30,
  FRIEND_FIRST: 15,
  FRIEND_ADD: 10,
  APP_SHARE: 20,
  PROFILE_AVATAR: 15,
  ACHIEVEMENT_EASY: 30,
  ACHIEVEMENT_MEDIUM: 75,
  ACHIEVEMENT_HARD: 150,
} as const;

export function getLevel(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function getLevelProgress(xp: number) {
  const level = getLevel(xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = level < 20 ? LEVEL_THRESHOLDS[level] : LEVEL_THRESHOLDS[19];
  const xpInLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  return {
    level,
    xpInLevel,
    xpNeeded,
    percent: level === 20 ? 100 : Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)),
    totalXP: xp,
  };
}
