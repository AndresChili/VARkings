import { GroupDetailClient } from '@/components/groups/group-detail-client';
import {
  DEMO_USER_ID,
  DEMO_GROUP,
  DEMO_LEADERBOARD,
  DEMO_MATCHES_WITH_PREDICTIONS,
  DEMO_CHAMPION_PICKS,
  DEMO_MY_PODIO,
  DEMO_PENDING_REQUESTS,
  DEMO_TEAMS,
  DEMO_MEMBER_GROUP_PICKS,
  DEMO_GROUP_QUALIFIERS,
  DEMO_MEMBER_LEVELS,
} from '@/lib/demo/demo-data';

export default function DemoGroupPage() {
  return (
    <GroupDetailClient
      basePath="/demo"
      group={DEMO_GROUP}
      leaderboard={DEMO_LEADERBOARD}
      matchesWithPredictions={DEMO_MATCHES_WITH_PREDICTIONS}
      userId={DEMO_USER_ID}
      memberCount={6}
      championPicks={DEMO_CHAMPION_PICKS}
      myPodio={DEMO_MY_PODIO}
      pendingRequests={DEMO_PENDING_REQUESTS}
      teams={DEMO_TEAMS}
      memberGroupPicks={DEMO_MEMBER_GROUP_PICKS}
      groupQualifiers={DEMO_GROUP_QUALIFIERS}
      memberLevels={DEMO_MEMBER_LEVELS}
    />
  );
}
