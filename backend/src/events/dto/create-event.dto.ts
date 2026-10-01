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
  @IsString({ message: 'El título es obligatorio' })
  title: string;

  @IsString({ message: 'La descripción es obligatoria' })
  description: string;

  @IsString({ message: 'El flyer del evento es obligatorio' })
  imageUrl: string;

  @IsOptional()
  @IsString()
  youtubeLink?: string;

  @IsDateString({}, { message: 'La fecha de inicio debe ser válida' })
  startDate: string;

  @IsDateString({}, { message: 'La fecha de fin debe ser válida' })
  endDate: string;

  @IsString({ message: 'El nombre del lugar es obligatorio' })
  venueName: string;

  @IsString({ message: 'La dirección es obligatoria' })
  venueAddress: string;

  @IsString()
  // FINISHED is set by the cron; cancelling needs refunds, which don't exist yet.
  @IsIn(['DRAFT', 'PUBLISHED'], {
    message: 'El estado tiene que ser borrador o publicado',
  })
  status: 'DRAFT' | 'PUBLISHED';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchDto)
  batches: BatchDto[];
}
