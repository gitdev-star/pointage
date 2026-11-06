CREATE TABLE IF NOT EXISTS ai_conversation (
  id bigserial PRIMARY KEY,
  username text NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ai_conversation_user_idx ON ai_conversation (username, updated_at DESC);
CREATE TABLE IF NOT EXISTS ai_message (
  id bigserial PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES ai_conversation(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  result text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ai_message_conv_idx ON ai_message (conversation_id, id);
