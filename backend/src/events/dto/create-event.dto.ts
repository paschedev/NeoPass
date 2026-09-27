import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BatchDto } from './batch.dto';

export class CreateEventDto {
  @IsString({ message: 'El título es requerido' })
  title: string;

  @IsString({ message: 'La descripción es requerida' })
  description: string;

  @IsString({ message: 'La imagen del evento (Flyer) es obligatoria' })
  imageUrl: string;

  @IsOptional()
  @IsString()
  youtubeLink?: string;

  @IsDateString({}, { message: 'La fecha de inicio debe ser válida' })
  startDate: string;

  @IsDateString({}, { message: 'La fecha de fin debe ser válida' })
  endDate: string;

  @IsString({ message: 'El nombre del lugar es requerido' })
  venueName: string;

  @IsString({ message: 'La dirección es requerida' })
  venueAddress: string;

  @IsString()
  @IsIn(['DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED'])
  status: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchDto)
  batches: BatchDto[];
}
