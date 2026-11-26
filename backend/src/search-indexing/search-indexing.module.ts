import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SearchIndexingProcessor } from './search-indexing.processor';
import {
  SEARCH_INDEXING_QUEUE,
  SearchIndexingService,
} from './search-indexing.service';

@Module({
  imports: [BullModule.registerQueue({ name: SEARCH_INDEXING_QUEUE })],
  providers: [SearchIndexingService, SearchIndexingProcessor],
  exports: [SearchIndexingService],
})
export class SearchIndexingModule {}
