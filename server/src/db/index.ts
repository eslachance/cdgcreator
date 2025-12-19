import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../data/karaoke.db');

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT,
      audio_path TEXT,
      duration REAL,
      lines_count INTEGER NOT NULL DEFAULT 6,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS singers (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      base_color TEXT NOT NULL DEFAULT '#FFFFFF',
      highlight_color TEXT NOT NULL DEFAULT '#FFFF00',
      start_line INTEGER NOT NULL DEFAULT 0,
      line_count INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lyric_lines (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      singer_id TEXT NOT NULL,
      text TEXT NOT NULL,
      line_number INTEGER NOT NULL DEFAULT 0,
      appear_start_time REAL NOT NULL,
      appear_end_time REAL NOT NULL,
      highlight_start_time REAL NOT NULL,
      highlight_end_time REAL NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
      FOREIGN KEY (singer_id) REFERENCES singers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_singers_song_id ON singers(song_id);
    CREATE INDEX IF NOT EXISTS idx_lyric_lines_song_id ON lyric_lines(song_id);
    CREATE INDEX IF NOT EXISTS idx_lyric_lines_singer_id ON lyric_lines(singer_id);
  `);

  runMigrations();
}

function runMigrations() {
  const tableInfo = db.prepare("PRAGMA table_info(songs)").all() as { name: string }[];
  const songColumns = tableInfo.map(col => col.name);
  
  if (!songColumns.includes('lines_count')) {
    db.exec(`ALTER TABLE songs ADD COLUMN lines_count INTEGER NOT NULL DEFAULT 6`);
  }
  if (!songColumns.includes('pre_buffer')) {
    db.exec(`ALTER TABLE songs ADD COLUMN pre_buffer REAL NOT NULL DEFAULT 0`);
  }
  if (!songColumns.includes('post_buffer')) {
    db.exec(`ALTER TABLE songs ADD COLUMN post_buffer REAL NOT NULL DEFAULT 0`);
  }
  if (!songColumns.includes('title_card')) {
    db.exec(`ALTER TABLE songs ADD COLUMN title_card TEXT`);  // JSON string
  }
  if (!songColumns.includes('end_card')) {
    db.exec(`ALTER TABLE songs ADD COLUMN end_card TEXT`);  // JSON string
  }
  if (!songColumns.includes('vocals_path')) {
    db.exec(`ALTER TABLE songs ADD COLUMN vocals_path TEXT`);
  }
  if (!songColumns.includes('instrumental_path')) {
    db.exec(`ALTER TABLE songs ADD COLUMN instrumental_path TEXT`);
  }
  if (!songColumns.includes('separation_status')) {
    db.exec(`ALTER TABLE songs ADD COLUMN separation_status TEXT DEFAULT 'pending'`);
  }
  if (!songColumns.includes('separation_error')) {
    db.exec(`ALTER TABLE songs ADD COLUMN separation_error TEXT`);
  }

  const singerInfo = db.prepare("PRAGMA table_info(singers)").all() as { name: string }[];
  const singerColumns = singerInfo.map(col => col.name);
  
  if (!singerColumns.includes('start_line')) {
    db.exec(`ALTER TABLE singers ADD COLUMN start_line INTEGER NOT NULL DEFAULT 0`);
  }
  if (!singerColumns.includes('line_count')) {
    db.exec(`ALTER TABLE singers ADD COLUMN line_count INTEGER NOT NULL DEFAULT 3`);
  }

  const lyricInfo = db.prepare("PRAGMA table_info(lyric_lines)").all() as { name: string }[];
  const lyricColumns = lyricInfo.map(col => col.name);
  
  if (!lyricColumns.includes('line_number')) {
    db.exec(`ALTER TABLE lyric_lines ADD COLUMN line_number INTEGER NOT NULL DEFAULT 0`);
  }
}

