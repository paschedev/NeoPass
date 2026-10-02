import { IsIn } from 'class-validator';
import { BATCH_SALE_ACTIONS } from '../batch-sale-action';
import type { BatchSaleAction } from '../batch-sale-action';

export class BatchSaleActionDto {
  @IsIn(BATCH_SALE_ACTIONS, { message: 'La acción no es válida' })
  action: BatchSaleAction;
}
