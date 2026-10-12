import { applyDecorators } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EVENT_PERMISSIONS } from '../co-organizers';
import { EVENT_LIMITS } from '../event-limits';
import { NO_FREE_TICKET_TYPES } from '../free-ticket-types';

const INVALID_FREE_TICKET_TYPES = 'Elegí tipos de entrada válidos';

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

// The ticket type names someone can send as free tickets, ticked by the owner.
// Whether they are types of the event is checked against the database.
export const FreeTicketTypeList = () =>
  applyDecorators(
    IsArray({ message: NO_FREE_TICKET_TYPES }),
    ArrayNotEmpty({ message: NO_FREE_TICKET_TYPES }),
    ArrayMaxSize(100, { message: INVALID_FREE_TICKET_TYPES }),
    IsString({ each: true, message: INVALID_FREE_TICKET_TYPES }),
    MaxLength(EVENT_LIMITS.ticketTypeName, {
      each: true,
      message: INVALID_FREE_TICKET_TYPES,
    }),
  );
