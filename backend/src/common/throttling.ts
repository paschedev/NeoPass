import { ExecutionContext, Injectable } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

// Same words as the 503 of a busy database: either way the user only needs to
// know it is a moment of high demand and that trying again in a while works.
export const BUSY_MESSAGE =
  'Hay mucha demanda en este momento. Probá de nuevo en unos segundos.';

// Counts per user instead of per IP, for routes where many people share one
// network on purpose (the scanners of a door, on the venue's WiFi). It goes
// after JwtAuthGuard, which sets `req.user`; the limit comes from @Throttle.
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const user: { userId?: string } | undefined = req.user;
    if (!user?.userId) {
      throw new Error('UserThrottlerGuard needs JwtAuthGuard before it');
    }
    return Promise.resolve(`user:${user.userId}`);
  }
}

// The global limit, per IP. It runs before any route guard, when the user is
// not known yet, so it leaves the routes that count per user to
// UserThrottlerGuard: a route skips the IP count only by using that guard.
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const guards = this.reflector.getAllAndMerge<unknown[]>(GUARDS_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    return Promise.resolve(guards.includes(UserThrottlerGuard));
  }
}
