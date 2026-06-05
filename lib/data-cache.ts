import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';

export const getCachedTeams = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase.from('teams').select('*').order('name');
    return data ?? [];
  },
  ['teams-all'],
  { revalidate: 3600, tags: ['teams'] }
);

export const getCachedGroupStageMatches = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('matches')
      .select('home_team_name, away_team_name, home_team_logo, away_team_logo, group_name')
      .not('group_name', 'is', null)
      .eq('stage', 'Group Stage');
    return data ?? [];
  },
  ['matches-group-stage'],
  { revalidate: 3600, tags: ['matches'] }
);

export const getCachedAllMatches = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true });
    return data ?? [];
  },
  ['matches-all'],
  { revalidate: 30, tags: ['matches'] }
);

export const getCachedUpcomingMatches = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('matches')
      .select('*')
      .gte('match_date', new Date().toISOString())
      .order('match_date', { ascending: true })
      .limit(10);
    return data ?? [];
  },
  ['matches-upcoming'],
  { revalidate: 60, tags: ['matches'] }
);

export function getCachedUserProfile(userId: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return data;
    },
    [`profile-${userId}`],
    { revalidate: 300, tags: [`profile-${userId}`] }
  )();
}
