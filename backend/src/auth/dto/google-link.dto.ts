import { IsNotEmpty, IsString } from 'class-validator';
import { GoogleSignInDto } from './google-sign-in.dto';

export class GoogleLinkDto extends GoogleSignInDto {
  @IsString({ message: 'La contraseña debe ser un texto' })
  @IsNotEmpty({ message: 'Ingresá tu contraseña' })
  password: string;
}
