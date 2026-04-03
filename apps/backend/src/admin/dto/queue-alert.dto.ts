import { IsNumber, IsOptional, IsString } from 'class-validator';

export class QueueAlertConfigDto {
  @IsNumber()
  backlogThreshold?: number;

  @IsNumber()
  failureRateThreshold?: number;

  @IsNumber()
  staleMinutes?: number;

  @IsString()
  @IsOptional()
  email?: string;
}

export class QueueAlertDto {
  active: boolean;
  type: 'backlog' | 'failure_rate' | 'worker_stale' | 'queue_stale';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}
