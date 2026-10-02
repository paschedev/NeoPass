import { ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
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

export class CreateEventDto extends EventLocationDto {
  @EventTitle()
  title: string;

  @EventDescription()
  description: string;

  @FlyerUrl()
  imageUrl: string;

  @YoutubeLink()
  youtubeLink?: string | null;

  @EventDate('La fecha de inicio debe ser válida')
  startDate: string;

  @EventDate('La fecha de fin debe ser válida')
  endDate: string;

  @VenueName()
  venueName: string;

  @VenueAddress()
  venueAddress: string;

  @EventStatusField()
  status: 'DRAFT' | 'PUBLISHED';

  @IsArray({ message: 'Las tandas no son válidas' })
  @ValidateNested({ each: true })
  @Type(() => BatchDto)
  batches: BatchDto[];
}
