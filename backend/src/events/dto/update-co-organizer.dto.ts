import { EventPermission } from '@prisma/client';
import { ValidateIf } from 'class-validator';
import {
  FreeTicketLimit,
  FreeTicketTypeList,
  PermissionList,
} from './co-organizer-terms';

export class UpdateCoOrganizerDto {
  @PermissionList()
  permissions: EventPermission[];

  @FreeTicketLimit()
  freeTicketLimit?: number | null;

  // The types they can send as free tickets; ignored without the permission.
  @ValidateIf(
    (o: UpdateCoOrganizerDto) =>
      Array.isArray(o.permissions) &&
      o.permissions.includes('SEND_FREE_TICKETS'),
  )
  @FreeTicketTypeList()
  freeTicketTypes?: string[];
}
