import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const dataDirectory = process.env.CITYNSIDE_DATA_DIR
  ? resolve(process.env.CITYNSIDE_DATA_DIR)
  : resolve(dirname(fileURLToPath(import.meta.url)), "..", "data");
mkdirSync(dataDirectory, { recursive: true });

export const database = new DatabaseSync(
  resolve(dataDirectory, "citynside.sqlite"),
);

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invitations (
    code_hash TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    used_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
`);

export function hashInvitation(code) {
  return createHash("sha256").update(code).digest("hex");
}
