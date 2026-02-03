import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class GradingPolicyUpdateDto {
  @IsOptional()
  @IsIn(['cheap', 'quality'])
  mode?: 'cheap' | 'quality';

  @IsOptional()
  @IsBoolean()
  needRewrite?: boolean;
}
