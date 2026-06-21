import { router } from '../trpc/index.js';
import { songsRouter } from './songs.js';
import { singersRouter } from './singers.js';
import { lyricsRouter } from './lyrics.js';

export const appRouter = router({
  songs: songsRouter,
  singers: singersRouter,
  lyrics: lyricsRouter,
});

export type AppRouter = typeof appRouter;

