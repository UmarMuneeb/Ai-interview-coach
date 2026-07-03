import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProviderHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkHealth(provider: string): Promise<boolean> {
    const health = await this.prisma.providerHealth.findUnique({
      where: { provider }
    });
    
    if (!health) {
      await this.prisma.providerHealth.create({
        data: { provider, status: 'healthy', consecutive_failures: 0 }
      });
      return true;
    }

    if (health.status === 'down' && health.cooldown_until && health.cooldown_until > new Date()) {
      return false; // Circuit breaker open
    }

    // Reset if cooldown expired
    if (health.status === 'down' && health.cooldown_until && health.cooldown_until <= new Date()) {
      await this.prisma.providerHealth.update({
        where: { provider },
        data: { status: 'healthy', consecutive_failures: 0, cooldown_until: null }
      });
      return true;
    }

    return health.status === 'healthy' || health.status === 'degraded';
  }

  async recordFailure(provider: string, errorMsg: string): Promise<void> {
    const health = await this.prisma.providerHealth.findUnique({ where: { provider } });
    const failures = (health?.consecutive_failures || 0) + 1;
    
    // Trip breaker after 3 failures
    const isDown = failures >= 3;
    const cooldown_until = isDown ? new Date(Date.now() + 5 * 60 * 1000) : null;

    await this.prisma.providerHealth.upsert({
      where: { provider },
      update: {
        consecutive_failures: failures,
        status: isDown ? 'down' : 'degraded',
        last_error: errorMsg,
        cooldown_until
      },
      create: {
        provider,
        consecutive_failures: failures,
        status: isDown ? 'down' : 'degraded',
        last_error: errorMsg,
        cooldown_until
      }
    });
  }

  async recordSuccess(provider: string): Promise<void> {
    // Only update if it had failures
    await this.prisma.providerHealth.updateMany({
      where: { provider, consecutive_failures: { gt: 0 } },
      data: { status: 'healthy', consecutive_failures: 0, cooldown_until: null, last_error: null }
    });
  }

  async logUsage(
    provider: string,
    model: string,
    sessionId: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number
  ) {
    return this.prisma.providerUsage.create({
      data: {
        provider,
        model,
        session_id: sessionId,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        audio_seconds: 0,
        cost_usd: costUsd
      }
    });
  }
}
