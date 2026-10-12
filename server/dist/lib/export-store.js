class ExportStore {
    jobs = new Map();
    createJob(id, songId, totalFrames) {
        const job = {
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
    getJob(id) {
        return this.jobs.get(id);
    }
    getJobBySongId(songId) {
        for (const job of this.jobs.values()) {
            if (job.songId === songId && (job.step !== 'error')) {
                return job;
            }
        }
        return undefined;
    }
    updateJob(id, updates) {
        const job = this.jobs.get(id);
        if (job) {
            Object.assign(job, updates);
        }
    }
    deleteJob(id) {
        this.jobs.delete(id);
    }
    cleanupOldJobs() {
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
