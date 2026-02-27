import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis';

@Injectable()
export class TokenBlacklistService {
  constructor(private readonly redis: RedisService) {}

  private key(jti: string): string {
    return `auth:blacklist:${jti}`;
  }

  async revoke(jti: string, expiresInSeconds: number): Promise<void> {
    const ttl = Math.max(expiresInSeconds, 60);
    await this.redis.set(this.key(jti), '1', ttl);
  }

  async isRevoked(jti: string): Promise<boolean> {
    return this.redis.exists(this.key(jti));
  }
}
