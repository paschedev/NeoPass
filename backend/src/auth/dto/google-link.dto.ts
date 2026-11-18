import { IsNotEmpty, IsString } from 'class-validator';
import { GoogleCredentialDto } from './google-sign-in.dto';

export class GoogleLinkDto extends GoogleCredentialDto {
  @IsString({ message: 'La contraseña debe ser un texto' })
  @IsNotEmpty({ message: 'Ingresá tu contraseña' })
  password: string;
}
