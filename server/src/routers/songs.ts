import { z } from 'zod';
import { nanoid } from 'nanoid';
import { router, publicProcedure } from '../trpc/index.js';
import { db } from '../db/index.js';
import {
  CreateSongInputSchema,
  UpdateSongInputSchema,
  DEFAULT_LINES_COUNT,
  type Song,
} from 'shared';

function rowToSong(row: any): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist || undefined,
    audioPath: row.audio_path,
    duration: row.duration,
    linesCount: row.lines_count ?? DEFAULT_LINES_COUNT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const songsRouter = router({
  list: publicProcedure.query(() => {
    const rows = db.prepare('SELECT * FROM songs ORDER BY created_at DESC').all();
    return rows.map(rowToSong);
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(input.id);
      if (!row) return null;
      return rowToSong(row);
    }),

  create: publicProcedure
    .input(CreateSongInputSchema)
    .mutation(({ input }) => {
      const id = nanoid();
      const now = new Date().toISOString();
      const linesCount = input.linesCount ?? DEFAULT_LINES_COUNT;
      
      db.prepare(`
        INSERT INTO songs (id, title, artist, lines_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, input.title, input.artist || null, linesCount, now, now);

      const defaultSingerId = nanoid();
      db.prepare(`
        INSERT INTO singers (id, song_id, name, "order", base_color, highlight_color, start_line, line_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(defaultSingerId, id, 'Singer 1', 0, '#FFFFFF', '#FFFF00', 0, linesCount, now, now);

      const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
      return rowToSong(row);
    }),

  update: publicProcedure
    .input(UpdateSongInputSchema)
    .mutation(({ input }) => {
      const { id, ...updates } = input;
      const now = new Date().toISOString();
      
      const setClauses: string[] = ['updated_at = ?'];
      const values: any[] = [now];

      if (updates.title !== undefined) {
        setClauses.push('title = ?');
        values.push(updates.title);
      }
      if (updates.artist !== undefined) {
        setClauses.push('artist = ?');
        values.push(updates.artist);
      }
      if (updates.linesCount !== undefined) {
        setClauses.push('lines_count = ?');
        values.push(updates.linesCount);
      }

      values.push(id);
      db.prepare(`UPDATE songs SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

      const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
      return rowToSong(row);
    }),

  updateAudio: publicProcedure
    .input(z.object({
      id: z.string(),
      audioPath: z.string(),
      duration: z.number(),
    }))
    .mutation(({ input }) => {
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE songs SET audio_path = ?, duration = ?, updated_at = ? WHERE id = ?
      `).run(input.audioPath, input.duration, now, input.id);

      const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(input.id);
      return rowToSong(row);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      db.prepare('DELETE FROM songs WHERE id = ?').run(input.id);
      return { success: true };
    }),
});

