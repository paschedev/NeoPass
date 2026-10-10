import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Without the spaces around and with single spaces between words.
const tidy = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

// Only the fields sent change; null (or empty) removes the producer name or
// the photo. The name can't be removed.
export class UpdateProfileDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(tidy)
  @IsString({ message: 'Escribí tu nombre y apellido' })
  @MinLength(2, { message: 'Escribí tu nombre y apellido' })
  @MaxLength(60, {
    message: 'El nombre y apellido puede tener hasta 60 caracteres',
  })
  name?: string;

  @IsOptional()
  @Transform(tidy)
  @IsString({ message: 'El nombre de la productora debe ser un texto' })
  @MaxLength(50, {
    message: 'El nombre de la productora puede tener hasta 50 caracteres',
  })
  companyName?: string | null;

  @IsOptional()
  @IsString({ message: 'Subí la foto desde NeoPass' })
  @MaxLength(500, { message: 'Subí la foto desde NeoPass' })
  avatarUrl?: string | null;
}
