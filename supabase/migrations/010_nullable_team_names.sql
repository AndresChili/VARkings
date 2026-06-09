-- Allow knockout matches without teams determined yet
ALTER TABLE matches ALTER COLUMN home_team_name DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN away_team_name DROP NOT NULL;
