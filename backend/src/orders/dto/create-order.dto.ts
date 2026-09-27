import {
  IsString,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsArray,
  ArrayNotEmpty,
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
  @IsString({ message: 'Token de seguridad requerido' })
  captchaToken: string;

  // Not @IsUUID: a malformed referral link must not block the purchase; the
  // repository only keeps it if it is an accepted promoter of the event.
  @IsOptional()
  @IsString()
  promoterId?: string;

  @IsArray({ message: 'Debes incluir al menos un item' })
  @ArrayNotEmpty({ message: 'Elegí al menos una entrada' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
