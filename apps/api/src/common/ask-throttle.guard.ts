import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { RateLimiter } from './rate-limiter';

const DEFAULT_PER_CLIENT_PER_HOUR = 10;
const DEFAULT_GLOBAL_PER_DAY = 200;

/**
 * Throttles the one endpoint that spends money on every call.
 *
 * Two limits with different jobs: the hourly per-client limit keeps one visitor
 * from monopolising the demo, and the daily global cap protects the API key
 * behind it. A public URL with an LLM behind it and no cap is an invitation.
 */
@Injectable()
export class AskThrottleGuard implements CanActivate {
  private readonly logger = new Logger(AskThrottleGuard.name);
  private readonly limiter: RateLimiter;

  constructor(config: ConfigService) {
    this.limiter = new RateLimiter({
      perClientPerHour: config.get<number>('ASK_RATE_LIMIT_PER_HOUR') ?? DEFAULT_PER_CLIENT_PER_HOUR,
      globalPerDay: config.get<number>('ASK_DAILY_CAP') ?? DEFAULT_GLOBAL_PER_DAY,
    });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const decision = this.limiter.check(clientId(request));

    if (!decision.allowed) {
      this.logger.warn(`Throttled ${clientId(request)}: ${decision.reason}`);
      throw new HttpException(
        { message: decision.reason, retryAfter: decision.retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

/**
 * Identify the caller.
 *
 * Behind a proxy the socket address is the proxy's, so the left-most entry of
 * x-forwarded-for is the closest thing to a client identity available. It is
 * spoofable; this is a speed bump, not authentication.
 */
function clientId(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(',')[0]?.trim();
  return first || request.ip || 'unknown';
}
