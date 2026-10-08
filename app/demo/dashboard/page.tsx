import { DashboardClient } from '@/components/dashboard/dashboard-client';
import {
  DEMO_USER_ID,
  DEMO_GROUP_ID,
  DEMO_GROUP,
  DEMO_TEAMS,
  DEMO_TOURNAMENT_PREDICTION,
} from '@/lib/demo/demo-data';

export default function DemoDashboardPage() {
  return (
    <DashboardClient
      basePath="/demo"
      userId={DEMO_USER_ID}
      groups={[
        {
          group_id: DEMO_GROUP_ID,
          member_count: 6,
          is_admin: true,
          groups: { id: DEMO_GROUP.id, name: DEMO_GROUP.name },
        },
      ]}
      tournamentPrediction={DEMO_TOURNAMENT_PREDICTION}
      teams={DEMO_TEAMS}
      groupInvites={[]}
    />
  );
}
