import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_FREE_TICKETS_PER_GRANT } from '../free-tickets';

export class SendFreeTicketsDto {
  @IsUUID('all', { message: 'Elegí un tipo de entrada' })
  ticketTypeId: string;

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'Mandá al menos una entrada' })
  @Max(MAX_FREE_TICKETS_PER_GRANT, {
    message: `Podés mandar hasta ${MAX_FREE_TICKETS_PER_GRANT} entradas por envío`,
  })
  quantity: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Debe ser un correo electrónico válido' })
  @MaxLength(254, { message: 'El correo es demasiado largo' })
  email: string;

  // Only for the greeting of the mail and the list of grants.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString({ message: 'El nombre no es válido' })
  @MaxLength(60, { message: 'El nombre puede tener hasta 60 caracteres' })
  name?: string | null;

  // Last moment the tickets let people in; without it, the whole event.
  @IsOptional()
  @IsDateString({}, { message: 'La hora límite no es válida' })
  validUntil?: string | null;
}
