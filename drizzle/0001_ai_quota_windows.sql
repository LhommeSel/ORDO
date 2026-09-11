CREATE TABLE IF NOT EXISTS ai_quota_windows (
  scope TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  reset_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  estimated_usd REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope, subject_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_quota_windows_reset_at
  ON ai_quota_windows (reset_at);
