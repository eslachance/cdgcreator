import { z } from 'zod';
import { nanoid } from 'nanoid';
import { router, publicProcedure } from '../trpc/index.js';
import { db } from '../db/index.js';
import { CreateSingerInputSchema, UpdateSingerInputSchema, } from 'shared';
function rowToSinger(row) {
    return {
        id: row.id,
        songId: row.song_id,
        name: row.name,
        order: row.order,
        baseColor: row.base_color,
        highlightColor: row.highlight_color,
        startLine: row.start_line ?? 0,
        lineCount: row.line_count ?? 3,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export const singersRouter = router({
    listBySong: publicProcedure
        .input(z.object({ songId: z.string() }))
        .query(({ input }) => {
        const rows = db.prepare('SELECT * FROM singers WHERE song_id = ? ORDER BY "order" ASC').all(input.songId);
        return rows.map(rowToSinger);
    }),
    getById: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(({ input }) => {
        const row = db.prepare('SELECT * FROM singers WHERE id = ?').get(input.id);
        if (!row)
            return null;
        return rowToSinger(row);
    }),
    create: publicProcedure
        .input(CreateSingerInputSchema)
        .mutation(({ input }) => {
        const id = nanoid();
        const now = new Date().toISOString();
        const maxOrderRow = db.prepare('SELECT MAX("order") as max_order FROM singers WHERE song_id = ?').get(input.songId);
        const order = (maxOrderRow?.max_order ?? -1) + 1;
        db.prepare(`
        INSERT INTO singers (id, song_id, name, "order", base_color, highlight_color, start_line, line_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.songId, input.name, order, input.baseColor || '#FFFFFF', input.highlightColor || '#FFFF00', input.startLine ?? 0, input.lineCount ?? 3, now, now);
        const row = db.prepare('SELECT * FROM singers WHERE id = ?').get(id);
        return rowToSinger(row);
    }),
    update: publicProcedure
        .input(UpdateSingerInputSchema)
        .mutation(({ input }) => {
        const { id, ...updates } = input;
        const now = new Date().toISOString();
        const setClauses = ['updated_at = ?'];
        const values = [now];
        if (updates.name !== undefined) {
            setClauses.push('name = ?');
            values.push(updates.name);
        }
        if (updates.baseColor !== undefined) {
            setClauses.push('base_color = ?');
            values.push(updates.baseColor);
        }
        if (updates.highlightColor !== undefined) {
            setClauses.push('highlight_color = ?');
            values.push(updates.highlightColor);
        }
        if (updates.order !== undefined) {
            setClauses.push('"order" = ?');
            values.push(updates.order);
        }
        if (updates.startLine !== undefined) {
            setClauses.push('start_line = ?');
            values.push(updates.startLine);
        }
        if (updates.lineCount !== undefined) {
            setClauses.push('line_count = ?');
            values.push(updates.lineCount);
        }
        values.push(id);
        db.prepare(`UPDATE singers SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
        const row = db.prepare('SELECT * FROM singers WHERE id = ?').get(id);
        return rowToSinger(row);
    }),
    delete: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(({ input }) => {
        db.prepare('DELETE FROM lyric_lines WHERE singer_id = ?').run(input.id);
        db.prepare('DELETE FROM singers WHERE id = ?').run(input.id);
        return { success: true };
    }),
});
