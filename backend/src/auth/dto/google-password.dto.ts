import { IsString, MaxLength, MinLength } from 'class-validator';
import { GoogleCredentialDto } from './google-sign-in.dto';

// Same rules as the password chosen when signing up.
export class GooglePasswordDto extends GoogleCredentialDto {
  @IsString({ message: 'La contraseña debe ser un texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(32, {
    message: 'La contraseña no puede tener más de 32 caracteres',
  })
  password: string;
}
