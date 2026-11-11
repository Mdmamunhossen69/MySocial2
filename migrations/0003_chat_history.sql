CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'নতুন চ্যাট',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES github_connections(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS chat_conversations_user_updated_idx
  ON chat_conversations(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(chat_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES github_connections(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx
  ON chat_messages(chat_id, user_id, created_at, id);
