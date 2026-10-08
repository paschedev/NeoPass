import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListAdminEventsQueryDto {
  // Part of the event's title or of its organizer's email.
  @IsOptional()
  @IsString({ message: 'La búsqueda no es válida' })
  @MaxLength(100, { message: 'La búsqueda puede tener hasta 100 caracteres' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página no es válida' })
  @Min(1, { message: 'La página no es válida' })
  @Max(10_000, { message: 'La página no es válida' })
  page = 1;
}
