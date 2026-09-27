import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TicketTypeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  tempId?: string;

  @IsString({ message: 'El nombre del ticket debe ser texto' })
  name: string;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0)
  price: number;

  @IsNumber({}, { message: 'El stock debe ser un número mayor a 0' })
  @Min(1)
  stock: number;
}

export class BatchDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  tempId?: string;

  @IsString({ message: 'El nombre de la tanda debe ser texto' })
  name: string;

  @IsString()
  @IsIn(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ENDED'])
  status: string;

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
