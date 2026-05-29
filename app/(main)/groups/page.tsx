import { createClient } from '@/lib/supabase/server';
import { GroupsClient } from '@/components/groups/groups-client';

type GroupData = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string | null;
  created_at: string;
};

type MembershipRow = {
  joined_at: string;
  groups: GroupData | null;
};

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberRows } = await supabase
    .from('group_members')
    .select('joined_at, group_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  const groupIds = memberRows?.map((m) => m.group_id) ?? [];
  const { data: groupsData } = groupIds.length > 0
    ? await supabase
        .from('groups')
        .select('id, name, description, invite_code, created_by, created_at')
        .in('id', groupIds)
    : { data: [] };

  const memberships: MembershipRow[] = (memberRows ?? []).map((m) => ({
    joined_at: m.joined_at,
    groups: (groupsData ?? []).find((g) => g.id === m.group_id) ?? null,
  }));

  const memberCounts: Record<string, number> = {};
  if (groupIds.length > 0) {
    const { data: counts } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds);
    (counts ?? []).forEach((m) => {
      memberCounts[m.group_id] = (memberCounts[m.group_id] ?? 0) + 1;
    });
  }

  return (
    <GroupsClient
      memberships={memberships}
      memberCounts={memberCounts}
      userId={user.id}
    />
  );
}
