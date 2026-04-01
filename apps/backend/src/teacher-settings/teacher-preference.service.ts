import { Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { GradingMode, GradingPreferenceDto, GradingPreferenceResponseDto } from './dto/grading-preference.dto';

@Injectable()
export class TeacherPreferenceService {
  private readonly logger = new Logger(TeacherPreferenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getGradingPreference(user: AuthUser): Promise<GradingPreferenceResponseDto> {
    const startedAt = Date.now();
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { gradingPreference: true },
    });

    const preference = userRecord?.gradingPreference as { mode?: GradingMode } | null;
    const result: GradingPreferenceResponseDto = {
      mode: preference?.mode || null,
    };

    this.logger.debug(
      `Teacher grading preference fetched userId=${user.id} mode=${result.mode} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  async updateGradingPreference(user: AuthUser, dto: GradingPreferenceDto): Promise<GradingPreferenceResponseDto> {
    const startedAt = Date.now();

    const currentPreference = (await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { gradingPreference: true },
    }))?.gradingPreference as { mode?: GradingMode } | null;

    const newPreference = {
      ...(currentPreference || {}),
      ...(dto.mode !== undefined && { mode: dto.mode }),
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { gradingPreference: newPreference },
    });

    const result: GradingPreferenceResponseDto = {
      mode: dto.mode || null,
    };

    this.logger.debug(
      `Teacher grading preference updated userId=${user.id} mode=${result.mode} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }
}
