import { z } from 'zod';
import { nanoid } from 'nanoid';
import { router, publicProcedure } from '../trpc/index.js';
import { db } from '../db/index.js';
import {
  CreateLyricLineInputSchema,
  UpdateLyricLineInputSchema,
  type LyricLine,
} from 'shared';

function rowToLyricLine(row: any): LyricLine {
  return {
    id: row.id,
    songId: row.song_id,
    singerId: row.singer_id,
    text: row.text,
    lineNumber: row.line_number ?? 0,
    appearStartTime: row.appear_start_time,
    appearEndTime: row.appear_end_time,
    highlightStartTime: row.highlight_start_time,
    highlightEndTime: row.highlight_end_time,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const lyricsRouter = router({
  listBySong: publicProcedure
    .input(z.object({ songId: z.string() }))
    .query(({ input }) => {
      const rows = db.prepare('SELECT * FROM lyric_lines WHERE song_id = ? ORDER BY "order" ASC').all(input.songId);
      return rows.map(rowToLyricLine);
    }),

  listBySinger: publicProcedure
    .input(z.object({ singerId: z.string() }))
    .query(({ input }) => {
      const rows = db.prepare('SELECT * FROM lyric_lines WHERE singer_id = ? ORDER BY "order" ASC').all(input.singerId);
      return rows.map(rowToLyricLine);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const row = db.prepare('SELECT * FROM lyric_lines WHERE id = ?').get(input.id);
      if (!row) return null;
      return rowToLyricLine(row);
    }),

  create: publicProcedure
    .input(CreateLyricLineInputSchema)
    .mutation(({ input }) => {
      const id = nanoid();
      const now = new Date().toISOString();
      
      const maxOrderRow = db.prepare(
        'SELECT MAX("order") as max_order FROM lyric_lines WHERE song_id = ?'
      ).get(input.songId) as { max_order: number | null };
      const order = (maxOrderRow?.max_order ?? -1) + 1;

      db.prepare(`
        INSERT INTO lyric_lines (id, song_id, singer_id, text, line_number, appear_start_time, appear_end_time, highlight_start_time, highlight_end_time, "order", created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.songId,
        input.singerId,
        input.text,
        input.lineNumber ?? 0,
        input.appearStartTime,
        input.appearEndTime,
        input.highlightStartTime,
        input.highlightEndTime,
        order,
        now,
        now
      );

      const row = db.prepare('SELECT * FROM lyric_lines WHERE id = ?').get(id);
      return rowToLyricLine(row);
    }),

  update: publicProcedure
    .input(UpdateLyricLineInputSchema)
    .mutation(({ input }) => {
      const { id, ...updates } = input;
      const now = new Date().toISOString();
      
      const setClauses: string[] = ['updated_at = ?'];
      const values: any[] = [now];

      if (updates.text !== undefined) {
        setClauses.push('text = ?');
        values.push(updates.text);
      }
      if (updates.singerId !== undefined) {
        setClauses.push('singer_id = ?');
        values.push(updates.singerId);
      }
      if (updates.appearStartTime !== undefined) {
        setClauses.push('appear_start_time = ?');
        values.push(updates.appearStartTime);
      }
      if (updates.appearEndTime !== undefined) {
        setClauses.push('appear_end_time = ?');
        values.push(updates.appearEndTime);
      }
      if (updates.highlightStartTime !== undefined) {
        setClauses.push('highlight_start_time = ?');
        values.push(updates.highlightStartTime);
      }
      if (updates.highlightEndTime !== undefined) {
        setClauses.push('highlight_end_time = ?');
        values.push(updates.highlightEndTime);
      }
      if (updates.order !== undefined) {
        setClauses.push('"order" = ?');
        values.push(updates.order);
      }
      if (updates.lineNumber !== undefined) {
        setClauses.push('line_number = ?');
        values.push(updates.lineNumber);
      }

      values.push(id);
      db.prepare(`UPDATE lyric_lines SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

      const row = db.prepare('SELECT * FROM lyric_lines WHERE id = ?').get(id);
      return rowToLyricLine(row);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      db.prepare('DELETE FROM lyric_lines WHERE id = ?').run(input.id);
      return { success: true };
    }),

  reorder: publicProcedure
    .input(z.object({
      songId: z.string(),
      lyricIds: z.array(z.string()),
    }))
    .mutation(({ input }) => {
      const now = new Date().toISOString();
      const updateStmt = db.prepare('UPDATE lyric_lines SET "order" = ?, updated_at = ? WHERE id = ?');
      
      const transaction = db.transaction(() => {
        input.lyricIds.forEach((id, index) => {
          updateStmt.run(index, now, id);
        });
      });
      
      transaction();
      return { success: true };
    }),

  bulkCreate: publicProcedure
    .input(z.object({
      songId: z.string(),
      singerId: z.string(),
      lines: z.array(z.object({
        text: z.string(),
        lineNumber: z.number().optional(),
        appearStartTime: z.number(),
        appearEndTime: z.number(),
        highlightStartTime: z.number(),
        highlightEndTime: z.number(),
      })),
    }))
    .mutation(({ input }) => {
      const now = new Date().toISOString();
      
      const singer = db.prepare('SELECT start_line, line_count FROM singers WHERE id = ?').get(input.singerId) as { start_line: number; line_count: number } | undefined;
      const singerStartLine = singer?.start_line ?? 0;
      const singerLineCount = singer?.line_count ?? 3;

      const maxOrderRow = db.prepare(
        'SELECT MAX("order") as max_order FROM lyric_lines WHERE song_id = ?'
      ).get(input.songId) as { max_order: number | null };
      let order = (maxOrderRow?.max_order ?? -1) + 1;

      const insertStmt = db.prepare(`
        INSERT INTO lyric_lines (id, song_id, singer_id, text, line_number, appear_start_time, appear_end_time, highlight_start_time, highlight_end_time, "order", created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const createdIds: string[] = [];

      const transaction = db.transaction(() => {
        for (let i = 0; i < input.lines.length; i++) {
          const line = input.lines[i];
          const id = nanoid();
          createdIds.push(id);
          const lineNumber = line.lineNumber ?? (singerStartLine + (i % singerLineCount));
          insertStmt.run(
            id,
            input.songId,
            input.singerId,
            line.text,
            lineNumber,
            line.appearStartTime,
            line.appearEndTime,
            line.highlightStartTime,
            line.highlightEndTime,
            order++,
            now,
            now
          );
        }
      });

      transaction();

      return { success: true, count: createdIds.length };
    }),

  clearBySong: publicProcedure
    .input(z.object({ songId: z.string() }))
    .mutation(({ input }) => {
      db.prepare('DELETE FROM lyric_lines WHERE song_id = ?').run(input.songId);
      return { success: true };
    }),
});

