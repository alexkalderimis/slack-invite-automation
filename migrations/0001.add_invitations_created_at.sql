ALTER TABLE invitations
  ADD COLUMN created_at timestamptz
             NOT NULL
             DEFAULT (NOW() at time zone 'utc');
