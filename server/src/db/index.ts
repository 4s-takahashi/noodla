import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH ?? './data/noodla.db';

// Ensure data directory exists
try {
  mkdirSync(dirname(DB_PATH), { recursive: true });
} catch {
  // Directory already exists
}

const productionSqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
productionSqlite.pragma('journal_mode = WAL');
productionSqlite.pragma('foreign_keys = ON');

const productionDb = drizzle(productionSqlite, { schema });

// ── テスト用DI差し替え機構 ─────────────────────────────────────────────────────
// テスト環境では setDb() でインメモリDBに差し替える。
// 本番コードはこの関数を呼び出さないため、本番DBへの影響はない。

let _db: BetterSQLite3Database<typeof schema> = productionDb;
let _sqlite: Database.Database = productionSqlite;

export function setDb(
  newDb: BetterSQLite3Database<typeof schema>,
  newSqlite: Database.Database,
): void {
  _db = newDb;
  _sqlite = newSqlite;
}

export function resetDb(): void {
  _db = productionDb;
  _sqlite = productionSqlite;
}

// Proxy を使って常に最新の _db / _sqlite を参照させる
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    return (_db as any)[prop];
  },
});

export const sqlite = new Proxy({} as Database.Database, {
  get(_target, prop) {
    return typeof (_sqlite as any)[prop] === 'function'
      ? (_sqlite as any)[prop].bind(_sqlite)
      : (_sqlite as any)[prop];
  },
});
