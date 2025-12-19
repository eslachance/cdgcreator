import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export type SeparationStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'unavailable';

export interface SeparationResult {
  status: SeparationStatus;
  vocalsPath?: string;
  instrumentalPath?: string;
  error?: string;
}

export interface SeparationProgress {
  status: SeparationStatus;
  progress: number;
  message?: string;
}

type ProgressCallback = (progress: SeparationProgress) => void;

let demucsAvailable: boolean | null = null;
let demucsPath: string | null = null;

function findDemucsPath(): string | null {
  if (demucsPath !== null) {
    return demucsPath;
  }

  try {
    if (process.platform === 'win32') {
      const result = execSync('where demucs', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const paths = result.trim().split('\n');
      if (paths.length > 0 && paths[0]) {
        demucsPath = paths[0].trim();
        return demucsPath;
      }
    } else {
      const result = execSync('which demucs', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      demucsPath = result.trim();
      return demucsPath;
    }
  } catch {
    const commonPaths = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python313', 'Scripts', 'demucs.exe'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python312', 'Scripts', 'demucs.exe'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python311', 'Scripts', 'demucs.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python313', 'Scripts', 'demucs.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'Scripts', 'demucs.exe'),
      '/usr/local/bin/demucs',
      '/usr/bin/demucs',
    ];
    
    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        demucsPath = p;
        return demucsPath;
      }
    }
  }
  
  return null;
}

export async function checkDemucsAvailable(): Promise<boolean> {
  if (demucsAvailable !== null) {
    return demucsAvailable;
  }

  const demPath = findDemucsPath();
  if (demPath) {
    demucsAvailable = true;
    return true;
  }

  return new Promise((resolve) => {
    const proc = spawn('demucs', ['--help'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        demucsAvailable = false;
        resolve(false);
      }
    }, 5000);

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        demucsAvailable = code === 0;
        resolve(code === 0);
      }
    });

    proc.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        demucsAvailable = false;
        resolve(false);
      }
    });
  });
}

function findOutputFiles(tempDir: string, inputFileName: string): { vocalsPath: string; noVocalsPath: string } | null {
  const possibleDirs = [
    path.join(tempDir, 'htdemucs', inputFileName),
    path.join(tempDir, 'htdemucs_6s', inputFileName),
    path.join(tempDir, 'htdemucs_ft', inputFileName),
    path.join(tempDir, 'mdx_extra', inputFileName),
  ];

  for (const dir of possibleDirs) {
    const vocalsPath = path.join(dir, 'vocals.wav');
    const noVocalsPath = path.join(dir, 'no_vocals.wav');
    
    if (fs.existsSync(vocalsPath) && fs.existsSync(noVocalsPath)) {
      return { vocalsPath, noVocalsPath };
    }
  }

  if (fs.existsSync(tempDir)) {
    try {
      const searchInDir = (dir: string): { vocalsPath: string; noVocalsPath: string } | null => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        let hasVocals = false;
        let hasNoVocals = false;
        let vocalsPath = '';
        let noVocalsPath = '';
        
        for (const entry of entries) {
          if (entry.isFile()) {
            if (entry.name === 'vocals.wav') {
              hasVocals = true;
              vocalsPath = path.join(dir, entry.name);
            } else if (entry.name === 'no_vocals.wav') {
              hasNoVocals = true;
              noVocalsPath = path.join(dir, entry.name);
            }
          } else if (entry.isDirectory()) {
            const found = searchInDir(path.join(dir, entry.name));
            if (found) return found;
          }
        }
        
        if (hasVocals && hasNoVocals) {
          return { vocalsPath, noVocalsPath };
        }
        return null;
      };
      
      return searchInDir(tempDir);
    } catch {
      return null;
    }
  }

  return null;
}

export async function separateAudio(
  inputPath: string,
  outputDir: string,
  onProgress?: ProgressCallback
): Promise<SeparationResult> {
  const available = await checkDemucsAvailable();
  if (!available) {
    return {
      status: 'unavailable',
      error: 'Demucs is not installed. Please install it with: pip install demucs',
    };
  }

  onProgress?.({ status: 'processing', progress: 0, message: 'Starting audio separation...' });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demucs-'));
  const inputFileName = path.basename(inputPath, path.extname(inputPath));

  return new Promise((resolve) => {
    const demucsCmd = findDemucsPath() || 'demucs';
    const args = [
      '-n', 'htdemucs',
      '--two-stems', 'vocals',
      '-o', tempDir,
      inputPath,
    ];

    console.log(`Running demucs: ${demucsCmd} ${args.join(' ')}`);

    const proc = spawn(demucsCmd, args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let stdout = '';
    let lastProgress = 0;

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      
      const progressMatch = text.match(/(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1], 10);
        if (progress > lastProgress) {
          lastProgress = progress;
          onProgress?.({ 
            status: 'processing', 
            progress, 
            message: `Separating audio... ${progress}%` 
          });
        }
      }
    });

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      const progressMatch = text.match(/(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1], 10);
        if (progress > lastProgress) {
          lastProgress = progress;
          onProgress?.({ 
            status: 'processing', 
            progress, 
            message: `Separating audio... ${progress}%` 
          });
        }
      }
    });

    proc.on('close', (code) => {
      console.log(`Demucs exited with code: ${code}`);
      console.log(`Looking for output files in: ${tempDir}`);
      
      onProgress?.({ status: 'processing', progress: 95, message: 'Looking for output files...' });
      
      const outputFiles = findOutputFiles(tempDir, inputFileName);
      
      if (outputFiles) {
        console.log(`Found output files: ${outputFiles.vocalsPath}, ${outputFiles.noVocalsPath}`);
        moveFiles(outputFiles.vocalsPath, outputFiles.noVocalsPath, outputDir, inputFileName, tempDir, onProgress, resolve);
        return;
      }

      if (code !== 0) {
        console.error(`Demucs failed. stderr: ${stderr}`);
        console.error(`stdout: ${stdout}`);
        fs.rmSync(tempDir, { recursive: true, force: true });
        resolve({
          status: 'failed',
          error: `Demucs failed with code ${code}. Check that demucs is properly installed.`,
        });
        return;
      }

      console.log(`Temp dir contents:`);
      try {
        const listDir = (dir: string, indent: string = '') => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            console.log(`${indent}${entry.name}${entry.isDirectory() ? '/' : ''}`);
            if (entry.isDirectory()) {
              listDir(path.join(dir, entry.name), indent + '  ');
            }
          }
        };
        listDir(tempDir);
      } catch (e) {
        console.log('Could not list temp dir:', e);
      }

      fs.rmSync(tempDir, { recursive: true, force: true });
      resolve({
        status: 'failed',
        error: 'Could not find separated audio files in demucs output',
      });
    });

    proc.on('error', (err) => {
      console.error(`Demucs process error: ${err.message}`);
      fs.rmSync(tempDir, { recursive: true, force: true });
      resolve({
        status: 'failed',
        error: `Failed to run demucs: ${err.message}`,
      });
    });
  });
}

function moveFiles(
  vocalsSource: string,
  noVocalsSource: string,
  outputDir: string,
  inputFileName: string,
  tempDir: string,
  onProgress: ProgressCallback | undefined,
  resolve: (result: SeparationResult) => void
) {
  const vocalsDest = path.join(outputDir, `${inputFileName}_vocals.wav`);
  const instrumentalDest = path.join(outputDir, `${inputFileName}_instrumental.wav`);

  try {
    console.log(`Copying ${vocalsSource} to ${vocalsDest}`);
    fs.copyFileSync(vocalsSource, vocalsDest);
    console.log(`Copying ${noVocalsSource} to ${instrumentalDest}`);
    fs.copyFileSync(noVocalsSource, instrumentalDest);
    fs.rmSync(tempDir, { recursive: true, force: true });

    onProgress?.({ status: 'complete', progress: 100, message: 'Separation complete!' });

    resolve({
      status: 'complete',
      vocalsPath: `/uploads/${path.basename(vocalsDest)}`,
      instrumentalPath: `/uploads/${path.basename(instrumentalDest)}`,
    });
  } catch (err) {
    console.error(`Failed to move files: ${err}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
    resolve({
      status: 'failed',
      error: `Failed to move output files: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }
}

export async function cleanupSeparatedFiles(vocalsPath: string | null, instrumentalPath: string | null): Promise<void> {
  const uploadDir = path.join(process.cwd(), 'server/uploads');
  
  if (vocalsPath) {
    const fullPath = path.join(uploadDir, path.basename(vocalsPath));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
  
  if (instrumentalPath) {
    const fullPath = path.join(uploadDir, path.basename(instrumentalPath));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}
