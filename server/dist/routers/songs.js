import { z } from 'zod';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { router, publicProcedure } from '../trpc/index.js';
import { db } from '../db/index.js';
import { CreateSongInputSchema, UpdateSongInputSchema, DEFAULT_LINES_COUNT, } from 'shared';
import { separateAudio, checkDemucsAvailable } from '../lib/audio-separator.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const separationJobs = new Map();
function parseCard(json) {
    if (!json)
        return undefined;
    try {
        return JSON.parse(json);
    }
    catch {
        return undefined;
    }
}
function rowToSong(row) {
    return {
        id: row.id,
        title: row.title,
        artist: row.artist || undefined,
        audioPath: row.audio_path,
        duration: row.duration,
        linesCount: row.lines_count ?? DEFAULT_LINES_COUNT,
        preBuffer: row.pre_buffer ?? 0,
        postBuffer: row.post_buffer ?? 0,
        titleCard: parseCard(row.title_card),
        endCard: parseCard(row.end_card),
        vocalsPath: row.vocals_path || null,
        instrumentalPath: row.instrumental_path || null,
        separationStatus: row.separation_status || 'pending',
        separationError: row.separation_error || null,
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
        if (!row)
            return null;
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
        const setClauses = ['updated_at = ?'];
        const values = [now];
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
        if (updates.preBuffer !== undefined) {
            setClauses.push('pre_buffer = ?');
            values.push(updates.preBuffer);
        }
        if (updates.postBuffer !== undefined) {
            setClauses.push('post_buffer = ?');
            values.push(updates.postBuffer);
        }
        if (updates.titleCard !== undefined) {
            setClauses.push('title_card = ?');
            values.push(JSON.stringify(updates.titleCard));
        }
        if (updates.endCard !== undefined) {
            setClauses.push('end_card = ?');
            values.push(JSON.stringify(updates.endCard));
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
    checkDemucsAvailable: publicProcedure.query(async () => {
        const available = await checkDemucsAvailable();
        return { available };
    }),
    startSeparation: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
        const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(input.id);
        if (!row) {
            throw new Error('Song not found');
        }
        if (!row.audio_path) {
            throw new Error('No audio file uploaded');
        }
        if (row.separation_status === 'processing') {
            return { status: 'already_processing' };
        }
        const available = await checkDemucsAvailable();
        if (!available) {
            const now = new Date().toISOString();
            db.prepare(`
          UPDATE songs SET separation_status = ?, separation_error = ?, updated_at = ? WHERE id = ?
        `).run('unavailable', 'Demucs is not installed', now, input.id);
            return { status: 'unavailable', error: 'Demucs is not installed' };
        }
        const now = new Date().toISOString();
        db.prepare(`
        UPDATE songs SET separation_status = ?, separation_error = NULL, updated_at = ? WHERE id = ?
      `).run('processing', now, input.id);
        separationJobs.set(input.id, { progress: 0, message: 'Starting...' });
        const audioPath = path.join(process.cwd(), row.audio_path.replace(/^\//, ''));
        separateAudio(audioPath, UPLOAD_DIR, (progress) => {
            separationJobs.set(input.id, { progress: progress.progress, message: progress.message || '' });
        }).then((result) => {
            const now = new Date().toISOString();
            if (result.status === 'complete') {
                db.prepare(`
            UPDATE songs SET 
              separation_status = ?,
              vocals_path = ?,
              instrumental_path = ?,
              separation_error = NULL,
              updated_at = ?
            WHERE id = ?
          `).run('complete', result.vocalsPath, result.instrumentalPath, now, input.id);
            }
            else {
                db.prepare(`
            UPDATE songs SET separation_status = ?, separation_error = ?, updated_at = ? WHERE id = ?
          `).run(result.status, result.error || null, now, input.id);
            }
            separationJobs.delete(input.id);
        }).catch((err) => {
            const now = new Date().toISOString();
            db.prepare(`
          UPDATE songs SET separation_status = ?, separation_error = ?, updated_at = ? WHERE id = ?
        `).run('failed', err.message, now, input.id);
            separationJobs.delete(input.id);
        });
        return { status: 'started' };
    }),
    getSeparationStatus: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(({ input }) => {
        const row = db.prepare('SELECT separation_status, separation_error, vocals_path, instrumental_path FROM songs WHERE id = ?').get(input.id);
        if (!row) {
            throw new Error('Song not found');
        }
        const job = separationJobs.get(input.id);
        return {
            status: row.separation_status,
            error: row.separation_error,
            vocalsPath: row.vocals_path,
            instrumentalPath: row.instrumental_path,
            progress: job?.progress ?? (row.separation_status === 'complete' ? 100 : 0),
            message: job?.message,
        };
    }),
});
