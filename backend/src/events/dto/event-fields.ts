import { applyDecorators } from '@nestjs/common';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { RequiredText } from '../../common/required-text.decorator';
import { EVENT_LIMITS, YOUTUBE_HOSTS } from '../event-limits';

// Rules of each event field, shared by the create and edit DTOs.

const LimitedText = (required: string, max: number, tooLong: string) =>
  applyDecorators(RequiredText(required), MaxLength(max, { message: tooLong }));

export const EventTitle = () =>
  LimitedText(
    'El título es obligatorio',
    EVENT_LIMITS.title,
    `El título puede tener hasta ${EVENT_LIMITS.title} caracteres`,
  );

export const EventDescription = () =>
  LimitedText(
    'La descripción es obligatoria',
    EVENT_LIMITS.description,
    `La descripción puede tener hasta ${EVENT_LIMITS.description} caracteres`,
  );

export const VenueName = () =>
  LimitedText(
    'El nombre del lugar es obligatorio',
    EVENT_LIMITS.venueName,
    `El nombre del lugar puede tener hasta ${EVENT_LIMITS.venueName} caracteres`,
  );

export const VenueAddress = () =>
  LimitedText(
    'La dirección es obligatoria',
    EVENT_LIMITS.venueAddress,
    `La dirección puede tener hasta ${EVENT_LIMITS.venueAddress} caracteres`,
  );

// Where the flyer may come from is checked by the service (it needs the
// Cloudinary account from the config).
export const FlyerUrl = () =>
  RequiredText('El flyer del evento es obligatorio');

const YOUTUBE_MESSAGE = 'El link tiene que ser de un video de YouTube';

// Optional; null removes the video.
export const YoutubeLink = () =>
  applyDecorators(
    IsOptional(),
    IsUrl(
      {
        protocols: ['https', 'http'],
        require_protocol: true,
        host_whitelist: YOUTUBE_HOSTS,
      },
      { message: YOUTUBE_MESSAGE },
    ),
    MaxLength(EVENT_LIMITS.youtubeLink, { message: YOUTUBE_MESSAGE }),
  );

export const EventDate = (message: string) => IsDateString({}, { message });

// FINISHED is set by the cron; cancelling needs refunds, which don't exist yet.
export const EventStatusField = () =>
  IsIn(['DRAFT', 'PUBLISHED'], {
    message: 'El estado tiene que ser borrador o publicado',
  });
