import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequiredText } from '../../common/required-text.decorator';
import { BatchDto } from './batch.dto';
import { EventLocationDto } from './event-location.dto';

export class UpdateEventDto extends EventLocationDto {
  @IsOptional()
  @RequiredText('El título es obligatorio')
  title?: string;

  @IsOptional()
  @RequiredText('La descripción es obligatoria')
  description?: string;

  @IsOptional()
  @RequiredText('El flyer del evento es obligatorio')
  imageUrl?: string;

  @IsOptional()
  @IsString()
  youtubeLink?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @RequiredText('El nombre del lugar es obligatorio')
  venueName?: string;

  @IsOptional()
  @RequiredText('La dirección es obligatoria')
  venueAddress?: string;

  @IsOptional()
  @IsString()
  // FINISHED is set by the cron; cancelling needs refunds, which don't exist yet.
  @IsIn(['DRAFT', 'PUBLISHED'], {
    message: 'El estado tiene que ser borrador o publicado',
  })
  status?: 'DRAFT' | 'PUBLISHED';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchDto)
  batches?: BatchDto[];
}
