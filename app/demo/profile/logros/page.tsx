import { LogrosClient } from '@/components/profile/logros-client';
import { DEMO_ACHIEVEMENT_STATS, DEMO_EARNED_IDS } from '@/lib/demo/demo-data';

export default function DemoLogrosPage() {
  return <LogrosClient stats={DEMO_ACHIEVEMENT_STATS} earnedIds={DEMO_EARNED_IDS} />;
}
