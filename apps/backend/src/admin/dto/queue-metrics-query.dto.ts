import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueueMetricsQueryDto {
  @IsOptional()
  @IsIn(['waiting', 'active', 'delayed', 'failed', 'completed', 'paused'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
