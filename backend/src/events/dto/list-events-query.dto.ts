import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página no es válida' })
  @Min(1, { message: 'La página no es válida' })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad por página no es válida' })
  @Min(1, { message: 'La cantidad por página no es válida' })
  @Max(50, { message: 'Se pueden pedir hasta 50 eventos por página' })
  limit = 24;
}
