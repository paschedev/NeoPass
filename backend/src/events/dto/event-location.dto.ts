import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const INVALID_LATITUDE = 'La latitud de la ubicación no es válida';
const INVALID_LONGITUDE = 'La longitud de la ubicación no es válida';
const INVALID_PLACE = 'El lugar elegido en el mapa no es válido';

// Where the venue is on the map. Optional: an event can have just its address.
// null clears a value; the service checks both coordinates come together.
export class EventLocationDto {
  @IsOptional()
  @IsNumber({}, { message: INVALID_LATITUDE })
  @Min(-90, { message: INVALID_LATITUDE })
  @Max(90, { message: INVALID_LATITUDE })
  latitude?: number | null;

  @IsOptional()
  @IsNumber({}, { message: INVALID_LONGITUDE })
  @Min(-180, { message: INVALID_LONGITUDE })
  @Max(180, { message: INVALID_LONGITUDE })
  longitude?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString({ message: 'La ciudad no es válida' })
  @MaxLength(100, { message: 'La ciudad puede tener hasta 100 caracteres' })
  venueCity?: string | null;

  // Google place ID of the venue picked from the list (null for a point set by
  // hand). Google Maps shows that place by name instead of by coordinates.
  @IsOptional()
  @IsString({ message: INVALID_PLACE })
  @MaxLength(512, { message: INVALID_PLACE })
  @Matches(/^[\w-]+$/, { message: INVALID_PLACE })
  venuePlaceId?: string | null;
}
