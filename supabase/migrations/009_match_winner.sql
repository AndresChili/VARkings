-- Add winner_team_name to matches for penalty-shootout winner tracking
ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_team_name text NULL;
