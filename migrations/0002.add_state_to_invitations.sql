ALTER TABLE invitations ADD COLUMN state smallint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS invitations_state_idx
      ON invitations (state);
