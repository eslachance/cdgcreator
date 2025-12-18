import { z } from 'zod';

export const DEFAULT_LINES_COUNT = 6;

// Card schema for title and end cards
export const CardSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().default(''),
  startTime: z.number().default(0),  // Can be negative for pre-buffer
  endTime: z.number().default(0),
});

export type Card = z.infer<typeof CardSchema>;

export const SingerSchema = z.object({
  id: z.string(),
  songId: z.string(),
  name: z.string(),
  order: z.number(),
  baseColor: z.string().default('#FFFFFF'),
  highlightColor: z.string().default('#FFFF00'),
  startLine: z.number().default(0),
  lineCount: z.number().default(3),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const LyricLineSchema = z.object({
  id: z.string(),
  songId: z.string(),
  singerId: z.string(),
  text: z.string(),
  lineNumber: z.number().default(0),
  appearStartTime: z.number(),
  appearEndTime: z.number(),
  highlightStartTime: z.number(),
  highlightEndTime: z.number(),
  order: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SongSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string().optional(),
  audioPath: z.string().nullable(),
  duration: z.number().nullable(),
  linesCount: z.number().default(DEFAULT_LINES_COUNT),
  preBuffer: z.number().default(0),  // Seconds of silence before audio
  postBuffer: z.number().default(0), // Seconds of silence after audio
  titleCard: CardSchema.optional(),
  endCard: CardSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateSongInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  artist: z.string().optional(),
  linesCount: z.number().min(1).max(12).optional(),
  preBuffer: z.number().min(0).optional(),
  postBuffer: z.number().min(0).optional(),
  titleCard: CardSchema.optional(),
  endCard: CardSchema.optional(),
});

export const UpdateSongInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required').optional(),
  artist: z.string().optional(),
  linesCount: z.number().min(1).max(12).optional(),
  preBuffer: z.number().min(0).optional(),
  postBuffer: z.number().min(0).optional(),
  titleCard: CardSchema.optional(),
  endCard: CardSchema.optional(),
});

export const CreateSingerInputSchema = z.object({
  songId: z.string(),
  name: z.string().min(1, 'Name is required'),
  baseColor: z.string().optional(),
  highlightColor: z.string().optional(),
  startLine: z.number().min(0).optional(),
  lineCount: z.number().min(1).optional(),
});

export const UpdateSingerInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  baseColor: z.string().optional(),
  highlightColor: z.string().optional(),
  order: z.number().optional(),
  startLine: z.number().min(0).optional(),
  lineCount: z.number().min(1).optional(),
});

export const CreateLyricLineInputSchema = z.object({
  songId: z.string(),
  singerId: z.string(),
  text: z.string(),
  lineNumber: z.number().min(0).optional(),
  appearStartTime: z.number().min(0),
  appearEndTime: z.number().min(0),
  highlightStartTime: z.number().min(0),
  highlightEndTime: z.number().min(0),
});

export const UpdateLyricLineInputSchema = z.object({
  id: z.string(),
  text: z.string().optional(),
  singerId: z.string().optional(),
  lineNumber: z.number().min(0).optional(),
  appearStartTime: z.number().min(0).optional(),
  appearEndTime: z.number().min(0).optional(),
  highlightStartTime: z.number().min(0).optional(),
  highlightEndTime: z.number().min(0).optional(),
  order: z.number().optional(),
});

export type Song = z.infer<typeof SongSchema>;
export type Singer = z.infer<typeof SingerSchema>;
export type LyricLine = z.infer<typeof LyricLineSchema>;
export type CreateSongInput = z.infer<typeof CreateSongInputSchema>;
export type UpdateSongInput = z.infer<typeof UpdateSongInputSchema>;
export type CreateSingerInput = z.infer<typeof CreateSingerInputSchema>;
export type UpdateSingerInput = z.infer<typeof UpdateSingerInputSchema>;
export type CreateLyricLineInput = z.infer<typeof CreateLyricLineInputSchema>;
export type UpdateLyricLineInput = z.infer<typeof UpdateLyricLineInputSchema>;

