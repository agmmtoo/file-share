-- Share metadata, previously held in KV. Moved here because a download cap needs
-- an atomic counter (KV is eventually consistent) and because KV's free tier
-- allows only 1,000 writes/day, which capped the app at ~500 uploads/day.
CREATE TABLE shares (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,               -- NULL for anonymous shares
  name          TEXT NOT NULL,
  size          INTEGER NOT NULL,
  content_type  TEXT NOT NULL,
  encrypted     INTEGER NOT NULL DEFAULT 0,
  finalized     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  max_downloads INTEGER,            -- NULL means unlimited
  downloads     INTEGER NOT NULL DEFAULT 0
);

-- Drives the opportunistic prune that replaces KV's expirationTtl.
CREATE INDEX shares_expires_at ON shares (expires_at);
CREATE INDEX shares_user_id ON shares (user_id);
