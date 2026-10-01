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
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_AMOUNT } from '../../common/amounts';
import { RequiredText } from '../../common/required-text.decorator';

export class TicketTypeDto {
  @IsOptional()
  @IsUUID('all', { message: 'La entrada no es válida' })
  id?: string;

  @IsOptional()
  @IsString()
  tempId?: string;

  @RequiredText('El nombre de la entrada es obligatorio')
  name: string;

  // The edit screen sends prices back as the API returns them: Decimal strings.
  @Type(() => Number)
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(MAX_AMOUNT, { message: 'El precio máximo es $99.999.999,99' })
  price: number;

  @IsInt({ message: 'El stock debe ser un número entero mayor a 0' })
  @Min(1, { message: 'El stock tiene que ser mayor a 0' })
  stock: number;
}

export class BatchDto {
  @IsOptional()
  @IsUUID('all', { message: 'La tanda no es válida' })
  id?: string;

  @IsOptional()
  @IsString()
  tempId?: string;

  @RequiredText('El nombre de la tanda es obligatorio')
  name: string;

  // Hidden batches are never sold; the rest sell within publishAt-closeAt.
  @IsBoolean()
  isVisible: boolean;

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  closeAt?: string;

  @IsOptional()
  @IsBoolean()
  publishWhenPreviousSoldOut?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketTypeDto)
  ticketTypes: TicketTypeDto[];
}
