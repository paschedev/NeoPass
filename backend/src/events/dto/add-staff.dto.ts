import {
  IsString,
  IsIn,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { StaffRole, CommissionType, EventPermission } from '@prisma/client';
import { MAX_AMOUNT } from '../../common/amounts';
import {
  FreeTicketLimit,
  FreeTicketTypeList,
  PermissionList,
} from './co-organizer-terms';

// Whether the invitation lets them send free tickets: a co-organizer with the
// permission, or a promoter with a limit.
const sendsFreeTickets = (o: AddStaffDto) =>
  (o.role === 'MANAGER' &&
    Array.isArray(o.permissions) &&
    o.permissions.includes('SEND_FREE_TICKETS')) ||
  (o.role === 'PROMOTER' &&
    o.freeTicketLimit !== undefined &&
    o.freeTicketLimit !== null);

export class AddStaffDto {
  @IsUUID('all', { message: 'Elegí a quién invitar' })
  userId: string;

  @IsIn(['MANAGER', 'SCANNER', 'PROMOTER'], {
    message: 'Elegí un rol válido para el staff',
  })
  role: StaffRole;

  @ValidateIf((o: AddStaffDto) => o.role === 'PROMOTER')
  @IsString({
    message: 'El tipo de comisión es obligatorio para los promotores',
  })
  @IsIn(['PERCENTAGE', 'FIXED'], {
    message: 'La comisión tiene que ser un porcentaje o un monto fijo',
  })
  commissionType?: CommissionType;

  @ValidateIf((o: AddStaffDto) => o.role === 'PROMOTER')
  @IsNumber(
    {},
    { message: 'El valor de la comisión es obligatorio para los promotores' },
  )
  @Min(0, { message: 'La comisión no puede ser negativa' })
  // A percentage has its own cap (100), which the service checks.
  @Max(MAX_AMOUNT, { message: 'La comisión máxima es $99.999.999,99' })
  commissionValue?: number;

  // Only co-organizers (MANAGER) have permissions; for the other roles they
  // are ignored.
  @ValidateIf(
    (o: AddStaffDto) => o.role === 'MANAGER' && o.permissions !== undefined,
  )
  @PermissionList()
  permissions?: EventPermission[];

  // A co-organizer's limit (none = no limit), or how many free tickets a
  // promoter can send (none = they can't). Ignored for scanners.
  @ValidateIf(
    (o: AddStaffDto) =>
      o.role === 'MANAGER' ||
      (o.role === 'PROMOTER' &&
        o.freeTicketLimit !== undefined &&
        o.freeTicketLimit !== null),
  )
  @FreeTicketLimit()
  freeTicketLimit?: number | null;

  // The types they can send as free tickets; ignored if they can't send any.
  @ValidateIf(sendsFreeTickets)
  @FreeTicketTypeList()
  freeTicketTypes?: string[];
}
