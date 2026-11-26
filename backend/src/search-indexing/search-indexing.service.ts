import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { EventStatus } from '@prisma/client';
import type { JobsOptions, Queue } from 'bullmq';

export const SEARCH_INDEXING_QUEUE = 'search-indexing';

export interface EventChangedJob {
  eventId: string;
}

// Un aviso por evento y por minuto: los cambios seguidos (editar el evento y
// después sus tandas) se juntan en uno, porque mientras el aviso espera, uno
// nuevo con el mismo id no se agrega. Al terminar se borra, así el próximo
// cambio puede avisar otra vez.
const DEBOUNCE_MS = 60_000;
const JOB_OPTIONS: JobsOptions = {
  delay: DEBOUNCE_MS,
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: true,
  removeOnFail: true,
};

@Injectable()
export class SearchIndexingService {
  private readonly logger = new Logger(SearchIndexingService.name);

  constructor(
    @InjectQueue(SEARCH_INDEXING_QUEUE) private readonly queue: Queue,
  ) {}

  // Después de guardar un cambio en un evento. Solo importa si el evento era
  // o pasó a ser público: un borrador no tiene página que indexar. El cambio
  // ya está guardado: si no se puede encolar, se anota y nada más.
  async eventChanged(
    eventId: string,
    statuses: (EventStatus | null | undefined)[],
  ) {
    if (!statuses.includes('PUBLISHED')) return;
    try {
      await this.queue.add(
        'event-changed',
        { eventId } satisfies EventChangedJob,
        { ...JOB_OPTIONS, jobId: `event-${eventId}` },
      );
    } catch (error) {
      this.logger.error(
        `Could not queue the search engine notice for event ${eventId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
