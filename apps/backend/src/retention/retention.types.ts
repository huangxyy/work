export type RetentionRunOptions = {
  days?: number;
  dryRun?: boolean;
  batchSize?: number;
  invokedBy?: 'cron' | 'manual';
};

export type RetentionStats = {
  cutoffDate: string;
  scanned: number;
  deleted: number;
  minioOk: number;
  minioFailed: number;
  dbFailed: number;
  dryRun: boolean;
  durationMs: number;
  sampleSubmissionIds: string[];
  sampleObjectKeys: string[];
};

export type RetentionHistoryEntry = RetentionStats & {
  ranAt: string;
  invokedBy: 'cron' | 'manual';
};
