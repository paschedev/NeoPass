import {
  IsString,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export const MAX_TICKETS_PER_ORDER = 10;

class OrderItemDto {
  @IsUUID('all', { message: 'La entrada seleccionada no es válida' })
  ticketTypeId: string;

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  @Max(MAX_TICKETS_PER_ORDER, {
    message: `Podés comprar hasta ${MAX_TICKETS_PER_ORDER} entradas por orden`,
  })
  quantity: number;
}

export class CreateOrderDto {
  @IsString({ message: 'Completá la verificación de seguridad' })
  captchaToken: string;

  // Not @IsUUID: a malformed referral link must not block the purchase; the
  // service only keeps it if it is an accepted promoter of the event.
  @IsOptional()
  @IsString({ message: 'El promotor no es válido' })
  promoterId?: string;

  @IsArray({ message: 'Elegí al menos una entrada' })
  @ArrayNotEmpty({ message: 'Elegí al menos una entrada' })
  @ArrayUnique((item?: OrderItemDto) => item?.ticketTypeId, {
    message: 'Cada entrada va una sola vez en la orden',
  })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
