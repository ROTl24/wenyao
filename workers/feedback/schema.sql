CREATE TABLE IF NOT EXISTS feedback_details (
  feedback_id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('analysis', 'follow-up')),
  target_id TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('helpful', 'problematic')),
  reasons_json TEXT NOT NULL,
  note TEXT NOT NULL,
  technical_json TEXT NOT NULL,
  content_opt_in INTEGER NOT NULL DEFAULT 0,
  content_json TEXT,
  deletion_credential_hash TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_details_updated_at ON feedback_details(updated_at);
CREATE INDEX IF NOT EXISTS feedback_details_target_id ON feedback_details(target_id);

CREATE TABLE IF NOT EXISTS feedback_daily_aggregates (
  day TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  reason TEXT NOT NULL,
  app_version TEXT NOT NULL,
  corpus_version TEXT NOT NULL,
  retrieval_mode TEXT NOT NULL,
  generation_model TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, sentiment, reason, app_version, corpus_version, retrieval_mode, generation_model)
);
