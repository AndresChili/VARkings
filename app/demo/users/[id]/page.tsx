import { UserProfileClient } from '@/components/profile/user-profile-client';
import { getAchievements } from '@/lib/achievements';
import { getDemoOtherProfile, DEMO_USER_ID, DEMO_ACHIEVEMENT_STATS } from '@/lib/demo/demo-data';

export default async function DemoUserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, levelProgress, stats } = getDemoOtherProfile(id);
  const completedAchievements = getAchievements(DEMO_ACHIEVEMENT_STATS).filter((a) => a.current >= a.target);

  return (
    <UserProfileClient
      profile={profile}
      levelProgress={levelProgress}
      stats={stats}
      completedAchievements={completedAchievements}
      currentUserId={DEMO_USER_ID}
      targetUserId={profile.id}
      initialFriendshipStatus="accepted"
    />
  );
}
