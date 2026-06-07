import { notFound, redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getUserXP } from '@/lib/xp-server';
import { getLevelProgress } from '@/lib/xp';
import { UserProfileClient } from '@/components/profile/user-profile-client';

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.id === id) redirect('/profile');

  const [profileRes, predsRes, tournamentRes, friendsRes] = await Promise.all([
    supabase.from('profiles').select('id, username, full_name, avatar_url').eq('id', id).single(),
    supabase
      .from('match_predictions')
      .select('points_total, points_winner, is_calculated')
      .eq('user_id', id),
    supabase
      .from('tournament_predictions')
      .select('champion, runner_up, third_place, champion_points, runner_up_points, third_place_points, is_calculated')
      .eq('user_id', id)
      .maybeSingle(),
    supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .or(`requester_id.eq.${id},addressee_id.eq.${id}`)
      .eq('status', 'accepted'),
  ]);

  if (!profileRes.data) notFound();

  const admin = createAdminClient();
  const totalXP = await getUserXP(admin, id);
  const levelProgress = getLevelProgress(totalXP);

  const preds = predsRes.data ?? [];
  const calculated = preds.filter((p) => p.is_calculated);
  const tp = tournamentRes.data;
  const tournamentPoints = tp
    ? (tp.champion_points ?? 0) + (tp.runner_up_points ?? 0) + (tp.third_place_points ?? 0)
    : 0;
  const matchPoints = calculated.reduce((sum, p) => sum + (p.points_total ?? 0), 0) + tournamentPoints;
  const winnerHits = calculated.filter((p) => (p.points_winner ?? 0) > 0).length;

  let initialFriendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none';
  if (user) {
    const { data: friendship } = await supabase
      .from('friendships')
      .select('requester_id, status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`
      )
      .maybeSingle();
    if (friendship) {
      if (friendship.status === 'accepted') initialFriendshipStatus = 'accepted';
      else if (friendship.requester_id === user.id) initialFriendshipStatus = 'pending_sent';
      else initialFriendshipStatus = 'pending_received';
    }
  }

  return (
    <UserProfileClient
      profile={profileRes.data}
      levelProgress={levelProgress}
      stats={{
        matchPoints,
        totalPredictions: preds.length,
        calculatedPredictions: calculated.length,
        winnerHits,
        friendsCount: friendsRes.count ?? 0,
      }}
      podio={
        tp
          ? { champion: tp.champion, runner_up: tp.runner_up, third_place: tp.third_place }
          : null
      }
      currentUserId={user?.id ?? null}
      targetUserId={id}
      initialFriendshipStatus={initialFriendshipStatus}
    />
  );
}
