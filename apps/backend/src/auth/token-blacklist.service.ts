import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);

  constructor(private readonly redis: RedisService) {}

  private key(jti: string): string {
    return `auth:blacklist:${jti}`;
  }

  async revoke(jti: string, expiresInSeconds: number): Promise<void> {
    const startedAt = Date.now();
    const ttl = Math.max(expiresInSeconds, 60);
    await this.redis.set(this.key(jti), '1', ttl);

    this.logger.debug(`Token revoked jti=${jti} ttl=${ttl} durationMs=${Date.now() - startedAt}`);
  }

  async isRevoked(jti: string): Promise<boolean> {
    const startedAt = Date.now();
    const revoked = await this.redis.exists(this.key(jti));

    this.logger.debug(`Token revocation checked jti=${jti} revoked=${revoked} durationMs=${Date.now() - startedAt}`);

    return revoked;
  }
}
