import { EventPermission } from '@prisma/client';
import { FreeTicketLimit, PermissionList } from './co-organizer-terms';

export class UpdateCoOrganizerDto {
  @PermissionList()
  permissions: EventPermission[];

  @FreeTicketLimit()
  freeTicketLimit?: number | null;
}
