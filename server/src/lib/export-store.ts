export type ExportStep = 'pending' | 'generating' | 'encoding' | 'complete' | 'error';

export interface ExportJob {
  id: string;
  songId: string;
  step: ExportStep;
  progress: number;
  totalFrames: number;
  currentFrame: number;
  filename?: string;
  data?: string;
  error?: string;
  createdAt: number;
}

class ExportStore {
  private jobs = new Map<string, ExportJob>();
  
  createJob(id: string, songId: string, totalFrames: number): ExportJob {
    const job: ExportJob = {
      id,
      songId,
      step: 'pending',
      progress: 0,
      totalFrames,
      currentFrame: 0,
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    this.cleanupOldJobs();
    return job;
  }
  
  getJob(id: string): ExportJob | undefined {
    return this.jobs.get(id);
  }
  
  getJobBySongId(songId: string): ExportJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.songId === songId && (job.step !== 'error')) {
        return job;
      }
    }
    return undefined;
  }
  
  updateJob(id: string, updates: Partial<ExportJob>): void {
    const job = this.jobs.get(id);
    if (job) {
      Object.assign(job, updates);
    }
  }
  
  deleteJob(id: string): void {
    this.jobs.delete(id);
  }
  
  private cleanupOldJobs(): void {
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > ONE_HOUR) {
        this.jobs.delete(id);
      }
    }
  }
}

export const exportStore = new ExportStore();

