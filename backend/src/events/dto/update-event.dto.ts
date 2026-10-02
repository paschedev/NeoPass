import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NotNullIfSent } from '../../common/not-null-if-sent.decorator';
import { BatchDto } from './batch.dto';
import { EventLocationDto } from './event-location.dto';
import {
  EventDate,
  EventDescription,
  EventStatusField,
  EventTitle,
  FlyerUrl,
  VenueAddress,
  VenueName,
  YoutubeLink,
} from './event-fields';

// Every field can be left out; the required ones can't be sent empty (null).
export class UpdateEventDto extends EventLocationDto {
  @NotNullIfSent()
  @EventTitle()
  title?: string;

  @NotNullIfSent()
  @EventDescription()
  description?: string;

  @NotNullIfSent()
  @FlyerUrl()
  imageUrl?: string;

  @YoutubeLink()
  youtubeLink?: string | null;

  @NotNullIfSent()
  @EventDate('La fecha de inicio debe ser válida')
  startDate?: string;

  @NotNullIfSent()
  @EventDate('La fecha de fin debe ser válida')
  endDate?: string;

  @NotNullIfSent()
  @VenueName()
  venueName?: string;

  @NotNullIfSent()
  @VenueAddress()
  venueAddress?: string;

  @NotNullIfSent()
  @EventStatusField()
  status?: 'DRAFT' | 'PUBLISHED';

  @IsOptional()
  @IsArray({ message: 'Las tandas no son válidas' })
  @ValidateNested({ each: true })
  @Type(() => BatchDto)
  batches?: BatchDto[];
}
