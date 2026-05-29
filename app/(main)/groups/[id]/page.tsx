import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GroupDetailClient } from '@/components/groups/group-detail-client';
import type { Match } from '@/types';

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [groupRes, memberRes] = await Promise.all([
    supabase.from('groups').select('*').eq('id', id).single(),
    supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!groupRes.data) notFound();
  if (!memberRes.data) redirect('/groups');

  const [leaderboardRes, matchesRes] = await Promise.all([
    supabase
      .from('group_leaderboard')
      .select('*')
      .eq('group_id', id)
      .order('total_points', { ascending: false }),
    supabase
      .from('matches')
      .select('*')
      .gte('match_date', new Date().toISOString())
      .order('match_date', { ascending: true })
      .limit(10),
  ]);

  return (
    <GroupDetailClient
      group={groupRes.data}
      leaderboard={leaderboardRes.data ?? []}
      upcomingMatches={(matchesRes.data ?? []) as Match[]}
      userId={user.id}
    />
  );
}
