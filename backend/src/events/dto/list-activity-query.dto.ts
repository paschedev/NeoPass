import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página no es válida' })
  @Min(1, { message: 'La página no es válida' })
  @Max(10_000, { message: 'La página no es válida' })
  page = 1;
}
