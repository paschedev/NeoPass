import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_AMOUNT } from '../../common/amounts';
import { EVENT_LIMITS } from '../event-limits';
import { RequiredText } from '../../common/required-text.decorator';

export class TicketTypeDto {
  @IsOptional()
  @IsUUID('all', { message: 'La entrada no es válida' })
  id?: string;

  @IsOptional()
  @IsString({ message: 'La entrada no es válida' })
  tempId?: string;

  @RequiredText('El nombre de la entrada es obligatorio')
  @MaxLength(EVENT_LIMITS.ticketTypeName, {
    message: `El nombre de la entrada puede tener hasta ${EVENT_LIMITS.ticketTypeName} caracteres`,
  })
  name: string;

  // The edit screen sends prices back as the API returns them: Decimal strings.
  @Type(() => Number)
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(MAX_AMOUNT, { message: 'El precio máximo es $99.999.999,99' })
  price: number;

  @IsInt({ message: 'El stock debe ser un número entero mayor a 0' })
  @Min(1, { message: 'El stock tiene que ser mayor a 0' })
  @Max(EVENT_LIMITS.stock, { message: 'El stock máximo es 100.000' })
  stock: number;
}

export class BatchDto {
  @IsOptional()
  @IsUUID('all', { message: 'La tanda no es válida' })
  id?: string;

  @IsOptional()
  @IsString({ message: 'La tanda no es válida' })
  tempId?: string;

  @RequiredText('El nombre de la tanda es obligatorio')
  @MaxLength(EVENT_LIMITS.batchName, {
    message: `El nombre de la tanda puede tener hasta ${EVENT_LIMITS.batchName} caracteres`,
  })
  name: string;

  // Hidden batches are never sold; the rest sell within publishAt-closeAt.
  @IsBoolean({ message: 'Elegí si la tanda es visible u oculta' })
  isVisible: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio de venta no es válida' })
  publishAt?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin de venta no es válida' })
  closeAt?: string;

  @IsOptional()
  @IsBoolean({ message: 'La publicación automática de la tanda no es válida' })
  publishWhenPreviousSoldOut?: boolean;

  @IsArray({ message: 'Las entradas de la tanda no son válidas' })
  @ValidateNested({ each: true })
  @Type(() => TicketTypeDto)
  ticketTypes: TicketTypeDto[];
}
