import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError } from 'bullmq';
import {
  INDEXNOW_ENDPOINT,
  eventUrl,
  indexNowBody,
  isPublicSite,
} from './index-now';
import {
  EventChangedJob,
  SEARCH_INDEXING_QUEUE,
} from './search-indexing.service';

const TIMEOUT_MS = 10_000;
// La clave, el sitio o el pedido están mal: reintentar no lo arregla.
const PERMANENT_ERRORS = new Set([400, 403, 422]);

@Processor(SEARCH_INDEXING_QUEUE)
export class SearchIndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchIndexingProcessor.name);
  private readonly publicSite: boolean;

  constructor(config: ConfigService) {
    super();
    this.publicSite = isPublicSite(config.getOrThrow<string>('FRONTEND_URL'));
  }

  // Los errores se relanzan: BullMQ reintenta con las opciones del aviso.
  async process(job: Job<EventChangedJob>) {
    if (!this.publicSite) return;

    const url = eventUrl(job.data.eventId);
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowBody([url])),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      this.logger.log(`IndexNow notified of ${url} (${res.status})`);
      return;
    }
    const message = `IndexNow answered ${res.status} for ${url}`;
    if (PERMANENT_ERRORS.has(res.status)) {
      this.logger.error(message);
      throw new UnrecoverableError(message);
    }
    this.logger.warn(message);
    throw new Error(message);
  }
}
