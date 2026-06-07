export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          api_id: number | null;
          name: string;
          short_name: string | null;
          logo_url: string | null;
          group_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          api_id?: number | null;
          name: string;
          short_name?: string | null;
          logo_url?: string | null;
          group_name?: string | null;
          created_at?: string;
        };
        Update: {
          api_id?: number | null;
          name?: string;
          short_name?: string | null;
          logo_url?: string | null;
          group_name?: string | null;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          invite_code: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          invite_code: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
      };
      join_requests: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'join_requests_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'join_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      matches: {
        Row: {
          id: string;
          api_id: number | null;
          home_team_name: string;
          away_team_name: string;
          home_team_logo: string | null;
          away_team_logo: string | null;
          home_team_api_id: number | null;
          away_team_api_id: number | null;
          match_date: string;
          stage: string;
          group_name: string | null;
          home_score: number | null;
          away_score: number | null;
          status: string;
          venue: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          api_id?: number | null;
          home_team_name: string;
          away_team_name: string;
          home_team_logo?: string | null;
          away_team_logo?: string | null;
          home_team_api_id?: number | null;
          away_team_api_id?: number | null;
          match_date: string;
          stage?: string;
          group_name?: string | null;
          home_score?: number | null;
          away_score?: number | null;
          status?: string;
          venue?: string | null;
        };
        Update: {
          home_score?: number | null;
          away_score?: number | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      group_tournament_predictions: {
        Row: {
          id: string;
          user_id: string;
          group_id: string;
          champion: string | null;
          runner_up: string | null;
          third_place: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          group_id: string;
          champion?: string | null;
          runner_up?: string | null;
          third_place?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          champion?: string | null;
          runner_up?: string | null;
          third_place?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tournament_predictions: {
        Row: {
          id: string;
          user_id: string;
          champion: string | null;
          runner_up: string | null;
          third_place: string | null;
          group_predictions: Json;
          champion_points: number;
          runner_up_points: number;
          third_place_points: number;
          group_predictions_points: number;
          is_calculated: boolean;
          submitted_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          champion?: string | null;
          runner_up?: string | null;
          third_place?: string | null;
          group_predictions?: Json;
          champion_points?: number;
          runner_up_points?: number;
          third_place_points?: number;
          group_predictions_points?: number;
          is_calculated?: boolean;
        };
        Update: {
          champion?: string | null;
          runner_up?: string | null;
          third_place?: string | null;
          group_predictions?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      match_predictions: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          predicted_home_score: number;
          predicted_away_score: number;
          points_winner: number;
          points_home_score: number;
          points_away_score: number;
          points_total: number;
          is_calculated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          match_id: string;
          predicted_home_score: number;
          predicted_away_score: number;
          points_winner?: number;
          points_home_score?: number;
          points_away_score?: number;
          points_total?: number;
          is_calculated?: boolean;
        };
        Update: {
          predicted_home_score?: number;
          predicted_away_score?: number;
          points_winner?: number;
          points_home_score?: number;
          points_away_score?: number;
          points_total?: number;
          is_calculated?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      points_log: {
        Row: {
          id: string;
          user_id: string;
          match_id: string | null;
          points: number;
          reason: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          match_id?: string | null;
          points: number;
          reason: string;
          description?: string | null;
        };
        Update: {
          description?: string | null;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: 'pending' | 'accepted';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'accepted';
          updated_at?: string;
        };
        Relationships: [];
      };
      group_invites: {
        Row: {
          id: string;
          group_id: string;
          inviter_id: string;
          invitee_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          inviter_id: string;
          invitee_id: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          status?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string | null;
          auth_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh?: string | null;
          auth_key?: string | null;
        };
        Update: {
          endpoint?: string;
          p256dh?: string | null;
          auth_key?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      group_leaderboard: {
        Row: {
          group_id: string;
          user_id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          total_points: number;
          scored_matches: number;
          calculated_matches: number;
          total_predictions: number;
          podio_points: number;
          groups_points: number;
          matches_points: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      calculate_match_points: {
        Args: { p_match_id: string; p_home_score: number; p_away_score: number };
        Returns: void;
      };
      generate_invite_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
