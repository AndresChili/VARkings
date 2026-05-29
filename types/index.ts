import type { Database } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Team = Database['public']['Tables']['teams']['Row'];
export type Group = Database['public']['Tables']['groups']['Row'];
export type GroupMember = Database['public']['Tables']['group_members']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type TournamentPrediction = Database['public']['Tables']['tournament_predictions']['Row'];
export type MatchPrediction = Database['public']['Tables']['match_predictions']['Row'];
export type PointsLog = Database['public']['Tables']['points_log']['Row'];
export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row'];
export type LeaderboardEntry = Database['public']['Views']['group_leaderboard']['Row'];

export type MatchStatus = 'NS' | '1H' | 'HT' | '2H' | 'ET' | 'P' | 'FT' | 'AET' | 'PEN' | 'SUSP' | 'INT' | 'ABD' | 'WO' | 'AWD';

export interface GroupWithMembers extends Group {
  members: Array<GroupMember & { profile: Profile }>;
  member_count: number;
}

export interface MatchWithPrediction extends Match {
  my_prediction?: MatchPrediction | null;
}

export interface GroupPredictions {
  [groupName: string]: [string, string];
}

export interface ScoreResult {
  points_winner: number;
  points_home_score: number;
  points_away_score: number;
  points_total: number;
}

export interface APIFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string };
    venue: { name: string; city: string } | null;
  };
  league: { round: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    fulltime: { home: number | null; away: number | null };
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
}
