import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const MAX_NOTIFICATIONS_PER_PAGE = 50;

export class ListNotificationsQueryDto {
  // The last notification of the previous page.
  @IsOptional()
  @IsUUID('all', { message: 'El cursor no es válido' })
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad por página no es válida' })
  @Min(1, { message: 'La cantidad por página no es válida' })
  @Max(MAX_NOTIFICATIONS_PER_PAGE, {
    message: `Se pueden pedir hasta ${MAX_NOTIFICATIONS_PER_PAGE} avisos por página`,
  })
  limit = 20;

  // Only the staff invitations.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'El filtro de solicitudes no es válido' })
  onlyRequests = false;
}
