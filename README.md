# CDG Creator

Open source, web-based karaoke timeline editor that generates professional CDG+MP3 karaoke files and MP4 video exports. Build karaoke tracks with precise timing controls, multi-singer support, and automatic vocal separation.

## Motivations

I just honestly wanted to make the karaoke version of one song for a friend. And I realized, with some search, that my options seemed limited to either software created in the last 90's that didn't work anymore, or super expensive $100/$200+ software, or some AI-generated trash.

So I just made my own karaoke creator with blackjack and hookers. 

Granted, 100% of this code has been generated with the help of the Cursor editor using the `claude-4.5-opus-high` model. But fret not, I'm actually a professional web developer with decades of experience, and I want to assure you that I know what I'm doing. I could have spent 6 months to a year, or more, doing this manually, painstakingly, and maybe get discouraged after a few months because it wasn't working the way I wanted and everything was pure torture... But I didn't. This took 2 days and a lot of excitement and I got it done. 

I could have perhaps taken all this, thrown on a subscribtion model, charged people for it, and made a buck. But if I could do it in a couple days, anybody could, so what's the point? I'd rather just let anyone benefit from the system and be happy with my contribution to the world, vibe-coded as it may be.

## Features

- **Timeline-based lyric editor** with full drag and drop support
- **Multi-singer support** with customizable colors per singer
- **Automatic vocal separation** using Demucs AI (locally driven, not service-based) - remove vocals from any song
- **CDG+MP3 export** - standard karaoke format compatible with all karaoke players, with anti-aliased text and a smooth highlight wipe
- **MP4 video export** - high-quality video files with animated lyrics
- **Title and end cards** with customizable text and timing
- **Pre/post buffer controls** for lead-in and fade-out timing to add time for title and end cards
- **Instrumental sections** automatically detected and displayed with progress bars when no lyrics appear for more than 5 seconds
- **Real-time preview** of lyric highlighting while you work

## System Requirements

- **Node.js** 18.x or later
- **Python** 3.9 or later (for vocal separation)
- **FFmpeg** installed and available in PATH

### FFmpeg Installation

**Windows:**
1. Download from https://ffmpeg.org/download.html or use Chocolatey:
   ```
   choco install ffmpeg
   ```
2. Ensure `ffmpeg` is available in your PATH

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt update
sudo apt install ffmpeg
```

### Demucs Installation (Optional - for vocal separation)

Demucs is required for the vocal/instrumental separation feature. Without it, the app will still work but you won't be able to automatically remove vocals from tracks.

**Windows:**

First, install PyTorch and torchaudio (CPU version):
```
pip install torch==2.6.0+cpu torchaudio==2.6.0+cpu --index-url https://download.pytorch.org/whl/cpu
```

Then install Demucs:
```
pip install demucs
```

If you have an NVIDIA GPU and want faster processing, install the CUDA version instead:
```
pip install torch==2.6.0+cu118 torchaudio==2.6.0+cu118 --index-url https://download.pytorch.org/whl/cu118
pip install demucs
```

**macOS / Linux:**
```bash
pip install demucs
```

This will automatically install the appropriate PyTorch version.

**Note:** Demucs requires a significant amount of RAM (8GB+) and runs much faster with a CUDA-capable GPU. On first run, it will download the model files (~1.5GB).

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd cdgcreator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the shared package:
   ```bash
   npm run build --workspace=shared
   ```

## Running the Application

**Development mode** (starts both client and server with hot reload):
```bash
npm run dev
```

The client will be available at http://localhost:5173 and the server at http://localhost:3001.

**Production build:**
```bash
npm run build
npm start
```

## Docker

The easiest way to run CDG Creator is with Docker. This bundles all dependencies (Node.js, Python, FFmpeg, Demucs) so you don't need to install anything else.

**Requirements:**
- Docker
- Docker Compose

**Quick start:**
```bash
docker compose up --build
```

The application will be available at http://localhost:8080

**What's included in the Docker image:**
- Node.js 20
- Python 3 with PyTorch (CPU) and Demucs
- FFmpeg
- All npm dependencies

**Persistent data:**

The Docker setup mounts two volumes to preserve your data:
- `./server/data` - SQLite database
- `./server/uploads` - Uploaded audio files

**Rebuilding after changes:**
```bash
docker compose up --build
```

**Running in the background:**
```bash
docker compose up -d
```

**Stopping:**
```bash
docker compose down
```

**Note:** The Docker image uses CPU-only PyTorch for compatibility. Audio separation will work but will be slower than with GPU acceleration. The first time you use vocal separation, Demucs will download its model files (~1.5GB) which may take a few minutes.

## Usage

1. **Create a new song** - Click "New Song" and enter the title and artist
2. **Upload audio** - Drag and drop or click to upload an MP3 or WAV file
3. **Separate vocals** (optional) - Click "Separate Vocals" to remove vocals using AI
4. **Add singers** - Create singers and assign colors for base text and highlight
5. **Add lyrics** - Click on the timeline to add lyric lines at specific timestamps
6. **Set timing** - Adjust appear/disappear times and highlight timing for each line
7. **Preview** - Use the player to preview your karaoke in real-time
8. **Export** - Generate CDG+MP3 files or MP4 video

## Project Structure

```
cdgcreator/
├── client/          # React frontend (Vite + TypeScript)
│   └── src/
│       ├── components/   # UI components
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities and tRPC client
├── server/          # Express backend (Node.js + TypeScript)
│   └── src/
│       ├── db/           # SQLite database setup
│       ├── lib/          # CDG/video generation, audio processing
│       ├── routers/      # tRPC API routers
│       └── trpc/         # tRPC setup
├── shared/          # Shared types and schemas (Zod)
└── package.json     # Root workspace configuration
```

## Technology Stack

**Frontend:**
- React 19 with TypeScript
- Tailwind CSS 4 for styling
- Radix UI for accessible components
- TanStack Query for data fetching
- tRPC for type-safe API calls

**Backend:**
- Express.js
- tRPC for API endpoints
- better-sqlite3 for database
- fluent-ffmpeg for audio/video processing
- sharp for image processing
- Zod for schema validation

**External Tools:**
- FFmpeg - audio/video encoding and manipulation
- Demucs - AI-powered vocal/instrumental separation

## CDG Format

CDG (CD+Graphics) is the standard format for karaoke files. This application generates:
- `.cdg` file containing graphics data (lyrics, colors, timing)
- `.mp3` file containing the audio track

These files can be played in any standard karaoke software or hardware player. The files are bundled as a ZIP archive for easy download.

The CDG output mirrors the preview: the same line layout, singer colors, title/end cards and instrumental progress bar. A few details of how it fits into the format's limits (300x216 pixels, 16 colors, 300 instructions per second):
- Text is rendered with a real font (Arial, or Liberation Sans as a metric-compatible fallback) and anti-aliased using shade ramps in the palette.
- Highlighting uses XOR tile updates, the technique professional karaoke discs use, so the wipe is pixel-smooth and cheap.
- Updates are scheduled by deadline (lines about to be sung are drawn first) so nothing drifts out of sync with the audio.
- One singer gets 8 shades of anti-aliasing, two singers get 4 each, and three or four singers use solid colors. Beyond four distinct color pairs, extra singers reuse the closest-looking colors.
- Lines with a line number beyond the song's line count are not shown, same as in the preview.

## Troubleshooting

**"FFmpeg not found" error:**
Make sure FFmpeg is installed and available in your system PATH. You can verify by running `ffmpeg -version` in your terminal.

**"Demucs is not installed" warning:**
This means vocal separation won't be available. Install Demucs with `pip install demucs` if you need this feature.

**Video export is slow:**
Video generation creates individual frames and encodes them. This is CPU-intensive. Expect ~1-5 minutes for a typical 3-4 minute song depending on your hardware.

**Audio separation is slow:**
Demucs uses deep learning models. GPU acceleration (CUDA) significantly speeds this up. On CPU-only systems, expect 5-15 minutes for a typical song.

## License

MIT

