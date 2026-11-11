CREATE TABLE IF NOT EXISTS user_usage (
  user_id TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  chat_count INTEGER NOT NULL DEFAULT 0,
  build_count INTEGER NOT NULL DEFAULT 0,
  code_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);
CREATE INDEX IF NOT EXISTS user_usage_date_idx ON user_usage(usage_date);
