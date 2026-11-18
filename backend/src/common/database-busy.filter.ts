import {
  ArgumentsHost,
  Catch,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { isDatabaseBusyError } from '../prisma/prisma-errors';

// Under a peak the database may not keep up: the buyer gets a 503 they can
// retry instead of a generic 500. Any other Prisma error keeps Nest's default
// handling.
@Catch(Prisma.PrismaClientKnownRequestError)
export class DatabaseBusyFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(DatabaseBusyFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (!isDatabaseBusyError(exception)) return super.catch(exception, host);

    const request = host.switchToHttp().getRequest<Request>();
    this.logger.warn(
      `Database busy (${exception.code}) on ${request.method} ${request.path}`,
    );
    super.catch(
      new ServiceUnavailableException(
        'Hay mucha demanda en este momento. Probá de nuevo en unos segundos.',
      ),
      host,
    );
  }
}
