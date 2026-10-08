import { FriendsClient } from '@/components/friends/friends-client';
import {
  DEMO_USER_ID,
  DEMO_FRIENDSHIPS,
  DEMO_FRIEND_PROFILES,
  DEMO_FRIEND_XP_MAP,
  DEMO_FRIEND_POINTS_MAP,
} from '@/lib/demo/demo-data';

export default function DemoFriendsPage() {
  return (
    <FriendsClient
      basePath="/demo"
      currentUserId={DEMO_USER_ID}
      friendships={DEMO_FRIENDSHIPS}
      profiles={DEMO_FRIEND_PROFILES}
      xpMap={DEMO_FRIEND_XP_MAP}
      pointsMap={DEMO_FRIEND_POINTS_MAP}
    />
  );
}
