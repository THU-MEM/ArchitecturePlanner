CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  document TEXT
);
INSERT OR IGNORE INTO plans (id, revision, document) VALUES (1, 0, NULL);
