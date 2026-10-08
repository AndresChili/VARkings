import { ProfileClient } from '@/components/profile/profile-client';
import { DEMO_PROFILE, DEMO_PROFILE_STATS, DEMO_ACHIEVEMENT_STATS, DEMO_LEVEL_PROGRESS, DEMO_EARNED_IDS } from '@/lib/demo/demo-data';

export default function DemoProfilePage() {
  return (
    <ProfileClient
      basePath="/demo"
      profile={DEMO_PROFILE}
      stats={DEMO_PROFILE_STATS}
      achievementData={{
        friendsCount: DEMO_ACHIEVEMENT_STATS.friendsCount,
        groupsCreated: DEMO_ACHIEVEMENT_STATS.groupsCreated,
        maxGroupMembers: DEMO_ACHIEVEMENT_STATS.maxGroupMembers,
        exactPredictions: DEMO_ACHIEVEMENT_STATS.exactPredictions,
        hasTournamentPrediction: DEMO_ACHIEVEMENT_STATS.hasTournamentPrediction,
        groupPredictionsCount: DEMO_ACHIEVEMENT_STATS.groupPredictionsCount,
        totalMatches: DEMO_ACHIEVEMENT_STATS.totalMatches,
        currentStreak: DEMO_ACHIEVEMENT_STATS.currentStreak,
        maxStreak: DEMO_ACHIEVEMENT_STATS.maxStreak,
        totalDaysActive: DEMO_ACHIEVEMENT_STATS.totalDaysActive,
      }}
      levelProgress={DEMO_LEVEL_PROGRESS}
      email="demo@varkings.app"
      isSuperadmin={false}
      unreadSuggestions={0}
      isOAuthUser={false}
      earnedIds={DEMO_EARNED_IDS}
    />
  );
}
