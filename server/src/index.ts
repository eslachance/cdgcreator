import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { existsSync, mkdirSync, unlinkSync, readFileSync } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { nanoid } from 'nanoid';

import { db, initializeDatabase } from './db/index.js';
import { createContext } from './trpc/index.js';
import { appRouter } from './routers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_DIR = join(__dirname, '../uploads');
const DATA_DIR = join(__dirname, '../data');
const CLIENT_DIST = join(__dirname, '../../client/dist');

[UPLOAD_DIR, DATA_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

initializeDatabase();

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: isProduction 
    ? true 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json());

app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${nanoid()}${extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3 and WAV files are allowed.'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration || 0);
      }
    });
  });
}

async function convertWavToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioBitrate(192)
      .on('end', () => {
        unlinkSync(inputPath);
        resolve();
      })
      .on('error', reject)
      .save(outputPath);
  });
}

app.post('/api/upload-audio/:songId', upload.single('audio'), async (req, res) => {
  try {
    const { songId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let finalPath = file.path;
    const isWav = file.mimetype === 'audio/wav' || 
                  file.mimetype === 'audio/wave' || 
                  file.mimetype === 'audio/x-wav';

    if (isWav) {
      const mp3Path = file.path.replace(/\.wav$/i, '.mp3');
      await convertWavToMp3(file.path, mp3Path);
      finalPath = mp3Path;
    }

    const duration = await getAudioDuration(finalPath);
    const relativePath = `/uploads/${finalPath.split(/[\\/]/).pop()}`;

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE songs SET audio_path = ?, duration = ?, updated_at = ? WHERE id = ?
    `).run(relativePath, duration, now, songId);

    res.json({
      success: true,
      audioPath: relativePath,
      duration,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process audio file' });
  }
});

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

if (isProduction && existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  
  app.get('*', (_req, res) => {
    const indexPath = join(CLIENT_DIST, 'index.html');
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Not found');
    }
  });
}

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (isProduction) {
    console.log('Running in production mode');
  }
});

