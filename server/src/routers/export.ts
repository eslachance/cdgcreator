import { z } from 'zod';
import { router, publicProcedure } from '../trpc/index.js';
import { db } from '../db/index.js';
import { generateCDG, hexToRGB, type LyricEvent, type TitleCard } from '../lib/cdg-generator.js';
import { generateVideo, calculateTotalFrames } from '../lib/video-generator.js';
import { exportStore, type ExportStep } from '../lib/export-store.js';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import os from 'os';
import archiver from 'archiver';
import { nanoid } from 'nanoid';

interface SongRow {
  id: string;
  title: string;
  artist: string | null;
  audio_path: string | null;
  duration: number | null;
  lines_count: number;
  pre_buffer: number;
  post_buffer: number;
  title_card: string | null;
  end_card: string | null;
}

interface CardData {
  enabled: boolean;
  text: string;
  startTime: number;
  endTime: number;
}

function parseCard(json: string | null): CardData | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

interface SingerRow {
  id: string;
  base_color: string;
  highlight_color: string;
}

interface LyricRow {
  id: string;
  singer_id: string;
  text: string;
  line_number: number;
  appear_start_time: number;
  appear_end_time: number;
  highlight_start_time: number;
  highlight_end_time: number;
}

function padAudioWithSilence(
  inputPath: string,
  preBufferSeconds: number,
  postBufferSeconds: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `padded_${Date.now()}.mp3`);
    
    let command = ffmpeg(inputPath);
    
    const filters: string[] = [];
    
    if (preBufferSeconds > 0 || postBufferSeconds > 0) {
      filters.push(`adelay=${Math.round(preBufferSeconds * 1000)}|${Math.round(preBufferSeconds * 1000)}`);
      filters.push(`apad=pad_dur=${postBufferSeconds}`);
    }
    
    if (filters.length > 0) {
      command = command.audioFilters(filters);
    }
    
    command
      .audioBitrate('192k')
      .audioCodec('libmp3lame')
      .output(outputPath)
      .on('end', () => {
        try {
          const buffer = fs.readFileSync(outputPath);
          fs.unlinkSync(outputPath);
          resolve(buffer);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err: Error) => {
        try { fs.unlinkSync(outputPath); } catch {}
        reject(err);
      })
      .run();
  });
}

function createZipBuffer(files: { name: string; data: Buffer }[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    
    for (const file of files) {
      archive.append(file.data, { name: file.name });
    }
    
    archive.finalize();
  });
}

async function runVideoExport(jobId: string, songId: string) {
  try {
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(songId) as SongRow | undefined;
    if (!song || !song.duration || !song.audio_path) {
      exportStore.updateJob(jobId, { step: 'error', error: 'Song not found or missing audio' });
      return;
    }
    
    const singers = db.prepare('SELECT * FROM singers WHERE song_id = ?').all(songId) as SingerRow[];
    const lyrics = db.prepare(
      'SELECT * FROM lyric_lines WHERE song_id = ? ORDER BY appear_start_time'
    ).all(songId) as LyricRow[];
    
    const preBuffer = song.pre_buffer || 0;
    const postBuffer = song.post_buffer || 0;
    
    const formattedSingers = singers.map(s => ({
      id: s.id,
      baseColor: s.base_color,
      highlightColor: s.highlight_color,
    }));
    
    const formattedLyrics = lyrics.map(l => ({
      id: l.id,
      singerId: l.singer_id,
      text: l.text,
      lineNumber: l.line_number,
      appearStartTime: l.appear_start_time,
      appearEndTime: l.appear_end_time,
      highlightStartTime: l.highlight_start_time,
      highlightEndTime: l.highlight_end_time,
    }));
    
    const parsedTitleCard = parseCard(song.title_card);
    const parsedEndCard = parseCard(song.end_card);
    
    let titleCard = undefined;
    let endCard = undefined;
    
    if (parsedTitleCard?.enabled) {
      titleCard = {
        enabled: true,
        text: parsedTitleCard.text || `${song.title}\n${song.artist || ''}`,
        startTime: parsedTitleCard.startTime,
        endTime: parsedTitleCard.endTime,
      };
    }
    
    if (parsedEndCard?.enabled) {
      endCard = {
        enabled: true,
        text: parsedEndCard.text || 'Thank You!',
        startTime: parsedEndCard.startTime,
        endTime: parsedEndCard.endTime,
      };
    }
    
    const tempDir = os.tmpdir();
    const outputId = nanoid();
    const outputPath = path.join(tempDir, `karaoke_${outputId}.mp4`);
    const audioPath = path.join(process.cwd(), song.audio_path);
    
    let paddedAudioPath = audioPath;
    
    if (preBuffer > 0 || postBuffer > 0) {
      paddedAudioPath = path.join(tempDir, `padded_${outputId}.mp3`);
      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg(audioPath);
        const filters: string[] = [];
        
        if (preBuffer > 0 || postBuffer > 0) {
          filters.push(`adelay=${Math.round(preBuffer * 1000)}|${Math.round(preBuffer * 1000)}`);
          filters.push(`apad=pad_dur=${postBuffer}`);
        }
        
        if (filters.length > 0) {
          command = command.audioFilters(filters);
        }
        
        command
          .audioBitrate('192k')
          .audioCodec('libmp3lame')
          .output(paddedAudioPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });
    }
    
    await generateVideo({
      duration: song.duration,
      linesCount: song.lines_count || 6,
      lyrics: formattedLyrics,
      singers: formattedSingers,
      titleCard,
      endCard,
      preBuffer,
      postBuffer,
      audioPath: paddedAudioPath,
      outputPath,
      onProgress: (step, progress, currentFrame) => {
        exportStore.updateJob(jobId, {
          step,
          progress,
          currentFrame: currentFrame ?? 0,
        });
      },
    });
    
    const videoBuffer = fs.readFileSync(outputPath);
    
    fs.unlinkSync(outputPath);
    if (paddedAudioPath !== audioPath) {
      try { fs.unlinkSync(paddedAudioPath); } catch {}
    }
    
    const baseName = song.artist 
      ? `${song.artist} - ${song.title}`.replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, ' ').trim()
      : song.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    
    exportStore.updateJob(jobId, {
      step: 'complete',
      progress: 100,
      filename: `${baseName}.mp4`,
      data: videoBuffer.toString('base64'),
    });
    
  } catch (err) {
    console.error('Video export error:', err);
    exportStore.updateJob(jobId, {
      step: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

export const exportRouter = router({
  generateCDG: publicProcedure
    .input(z.object({ songId: z.string() }))
    .mutation(async ({ input }) => {
      const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(input.songId) as SongRow | undefined;
      if (!song) {
        throw new Error('Song not found');
      }
      
      if (!song.duration) {
        throw new Error('Song has no duration - please upload audio first');
      }
      
      if (!song.audio_path) {
        throw new Error('Song has no audio file');
      }
      
      const singers = db.prepare('SELECT * FROM singers WHERE song_id = ?').all(input.songId) as SingerRow[];
      const singerMap = new Map<string, SingerRow>();
      singers.forEach(s => singerMap.set(s.id, s));
      
      const lyrics = db.prepare(
        'SELECT * FROM lyric_lines WHERE song_id = ? ORDER BY appear_start_time'
      ).all(input.songId) as LyricRow[];
      
      const lyricEvents: LyricEvent[] = lyrics.map(lyric => {
        const singer = singerMap.get(lyric.singer_id);
        return {
          text: lyric.text,
          lineNumber: lyric.line_number,
          appearStartTime: lyric.appear_start_time,
          appearEndTime: lyric.appear_end_time,
          highlightStartTime: lyric.highlight_start_time,
          highlightEndTime: lyric.highlight_end_time,
          baseColor: hexToRGB(singer?.base_color || '#FFFFFF'),
          highlightColor: hexToRGB(singer?.highlight_color || '#FFFF00'),
        };
      });
      
      const preBuffer = song.pre_buffer || 0;
      const postBuffer = song.post_buffer || 0;
      
      const parsedTitleCard = parseCard(song.title_card);
      const parsedEndCard = parseCard(song.end_card);
      
      let titleCard: TitleCard | undefined;
      let endCard: TitleCard | undefined;
      
      if (parsedTitleCard?.enabled) {
        titleCard = {
          enabled: true,
          text: parsedTitleCard.text || `${song.title}\n${song.artist || ''}`,
          startTime: parsedTitleCard.startTime,
          endTime: parsedTitleCard.endTime,
        };
      }
      
      if (parsedEndCard?.enabled) {
        endCard = {
          enabled: true,
          text: parsedEndCard.text || 'Thank You!',
          startTime: parsedEndCard.startTime,
          endTime: parsedEndCard.endTime,
        };
      }
      
      const cdgBuffer = await generateCDG({
        duration: song.duration,
        linesCount: song.lines_count || 6,
        lyrics: lyricEvents,
        titleCard,
        endCard,
        preBuffer,
        postBuffer,
      });
      
      const audioPath = path.join(process.cwd(), song.audio_path);
      
      let audioBuffer: Buffer;
      if (preBuffer > 0 || postBuffer > 0) {
        audioBuffer = await padAudioWithSilence(audioPath, preBuffer, postBuffer);
      } else {
        audioBuffer = fs.readFileSync(audioPath);
      }
      
      const baseName = song.artist 
        ? `${song.artist} - ${song.title}`.replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, ' ').trim()
        : song.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      
      const zipBuffer = await createZipBuffer([
        { name: `${baseName}.cdg`, data: cdgBuffer },
        { name: `${baseName}.mp3`, data: audioBuffer },
      ]);
      
      return {
        filename: `${baseName}.zip`,
        data: zipBuffer.toString('base64'),
        size: zipBuffer.length,
      };
    }),

  startVideoExport: publicProcedure
    .input(z.object({ songId: z.string() }))
    .mutation(async ({ input }) => {
      const existingJob = exportStore.getJobBySongId(input.songId);
      if (existingJob && existingJob.step !== 'complete' && existingJob.step !== 'error') {
        return { jobId: existingJob.id, alreadyRunning: true };
      }
      
      const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(input.songId) as SongRow | undefined;
      if (!song) {
        throw new Error('Song not found');
      }
      
      if (!song.duration) {
        throw new Error('Song has no duration - please upload audio first');
      }
      
      if (!song.audio_path) {
        throw new Error('Song has no audio file');
      }
      
      const preBuffer = song.pre_buffer || 0;
      const postBuffer = song.post_buffer || 0;
      const totalFrames = calculateTotalFrames(song.duration, preBuffer, postBuffer);
      
      const jobId = nanoid();
      exportStore.createJob(jobId, input.songId, totalFrames);
      
      runVideoExport(jobId, input.songId);
      
      return { jobId, alreadyRunning: false };
    }),

  getVideoExportStatus: publicProcedure
    .input(z.object({ songId: z.string() }))
    .query(({ input }) => {
      const job = exportStore.getJobBySongId(input.songId);
      if (!job) {
        return { status: 'idle' as const };
      }
      
      return {
        status: job.step as ExportStep,
        progress: job.progress,
        totalFrames: job.totalFrames,
        currentFrame: job.currentFrame,
        error: job.error,
        hasData: job.step === 'complete' && !!job.data,
      };
    }),

  downloadVideo: publicProcedure
    .input(z.object({ songId: z.string() }))
    .mutation(({ input }) => {
      const job = exportStore.getJobBySongId(input.songId);
      if (!job || job.step !== 'complete' || !job.data || !job.filename) {
        throw new Error('No completed export available');
      }
      
      return {
        filename: job.filename,
        data: job.data,
      };
    }),

  cancelVideoExport: publicProcedure
    .input(z.object({ songId: z.string() }))
    .mutation(({ input }) => {
      const job = exportStore.getJobBySongId(input.songId);
      if (job) {
        exportStore.deleteJob(job.id);
      }
      return { success: true };
    }),
});
