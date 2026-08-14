PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  country_code TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'muted', 'suspended', 'closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE auth_identities (
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_normalized TEXT,
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_subject)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_digest BLOB NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,
  ip_prefix_hash BLOB,
  user_agent_hash BLOB
);
CREATE INDEX sessions_user_active ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE ratings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pool TEXT NOT NULL CHECK (pool IN ('bullet', 'blitz', 'rapid', 'classical', 'correspondence')),
  rating REAL NOT NULL DEFAULT 1500,
  deviation REAL NOT NULL DEFAULT 350,
  volatility REAL NOT NULL DEFAULT 0.06,
  games_played INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, pool)
);
CREATE INDEX ratings_leaderboard ON ratings(pool, rating DESC, games_played DESC);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('created', 'playing', 'finished', 'aborted')),
  rated INTEGER NOT NULL CHECK (rated IN (0, 1)),
  pool TEXT NOT NULL,
  black_user_id TEXT REFERENCES users(id),
  white_user_id TEXT REFERENCES users(id),
  initial_ms INTEGER NOT NULL,
  increment_ms INTEGER NOT NULL DEFAULT 0,
  result TEXT CHECK (result IN ('black', 'white', 'draw')),
  finish_reason TEXT,
  final_black_score INTEGER,
  final_white_score INTEGER,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  durable_object_id TEXT NOT NULL UNIQUE,
  protocol_version INTEGER NOT NULL
);
CREATE INDEX games_black_history ON games(black_user_id, created_at DESC);
CREATE INDEX games_white_history ON games(white_user_id, created_at DESC);
CREATE INDEX games_live ON games(status, created_at DESC);

CREATE TABLE moves (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  player TEXT NOT NULL CHECK (player IN ('black', 'white')),
  square INTEGER NOT NULL CHECK (square BETWEEN 0 AND 63),
  flipped_mask TEXT NOT NULL,
  position_hash TEXT NOT NULL,
  black_ms INTEGER NOT NULL,
  white_ms INTEGER NOT NULL,
  played_at INTEGER NOT NULL,
  command_id TEXT NOT NULL,
  PRIMARY KEY (game_id, ply),
  UNIQUE (game_id, command_id)
);

CREATE TABLE rating_events (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  pool TEXT NOT NULL,
  rating_before REAL NOT NULL,
  rating_after REAL NOT NULL,
  deviation_before REAL NOT NULL,
  deviation_after REAL NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (game_id, user_id)
);

CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('arena', 'swiss', 'round_robin')),
  pool TEXT NOT NULL,
  rated INTEGER NOT NULL CHECK (rated IN (0, 1)),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'running', 'finished', 'cancelled')),
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE tournament_entries (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score REAL NOT NULL DEFAULT 0,
  tie_break REAL NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  withdrawn_at INTEGER,
  PRIMARY KEY (tournament_id, user_id)
);
CREATE INDEX tournament_standings ON tournament_entries(tournament_id, score DESC, tie_break DESC);

CREATE TABLE moderation_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT REFERENCES users(id),
  subject_user_id TEXT REFERENCES users(id),
  game_id TEXT REFERENCES games(id),
  category TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX moderation_queue ON moderation_reports(status, created_at);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX audit_target ON audit_events(target_type, target_id, created_at DESC);

CREATE TABLE idempotency_keys (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  published_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX outbox_pending ON outbox(published_at, created_at);
