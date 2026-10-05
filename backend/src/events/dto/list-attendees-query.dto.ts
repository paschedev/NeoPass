import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListAttendeesQueryDto {
  // Part of the holder's name or email.
  @IsOptional()
  @IsString({ message: 'La búsqueda no es válida' })
  @MaxLength(100, { message: 'La búsqueda puede tener hasta 100 caracteres' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página no es válida' })
  @Min(1, { message: 'La página no es válida' })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad por página no es válida' })
  @Min(1, { message: 'La cantidad por página no es válida' })
  @Max(100, { message: 'Se pueden pedir hasta 100 asistentes por página' })
  limit = 50;
}
