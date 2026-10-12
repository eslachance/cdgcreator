import { router } from '../trpc/index.js';
import { songsRouter } from './songs.js';
import { singersRouter } from './singers.js';
import { lyricsRouter } from './lyrics.js';
import { exportRouter } from './export.js';
export const appRouter = router({
    songs: songsRouter,
    singers: singersRouter,
    lyrics: lyricsRouter,
    export: exportRouter,
});
