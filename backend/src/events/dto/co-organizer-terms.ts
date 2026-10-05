import { applyDecorators } from '@nestjs/common';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { EVENT_PERMISSIONS } from '../co-organizers';

// The checkboxes of a co-organizer.
export const PermissionList = () =>
  applyDecorators(
    IsArray({ message: 'Elegí los permisos' }),
    ArrayUnique({ message: 'No repitas permisos' }),
    IsIn(EVENT_PERMISSIONS, {
      each: true,
      message: 'Elegí permisos válidos',
    }),
  );

// How many free tickets a co-organizer can send; without it, no limit.
export const FreeTicketLimit = () =>
  applyDecorators(
    IsOptional(),
    IsInt({
      message: 'El tope de QR free tiene que ser un número entero mayor a 0',
    }),
    Min(1, {
      message: 'El tope de QR free tiene que ser un número entero mayor a 0',
    }),
    Max(100_000, { message: 'El tope de QR free máximo es 100.000' }),
  );
