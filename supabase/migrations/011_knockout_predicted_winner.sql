-- Track predicted penalty winner for knockout matches that end in a draw
ALTER TABLE match_predictions ADD COLUMN IF NOT EXISTS predicted_winner TEXT NULL;
