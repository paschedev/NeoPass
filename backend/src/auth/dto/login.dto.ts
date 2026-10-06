import { IsString, IsOptional, MinLength } from 'class-validator';
import { EmailField } from '../../common/email-field.decorator';

export class LoginDto {
  @EmailField()
  email: string;

  @IsString({ message: 'La contraseña debe ser un texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsOptional()
  @IsString({ message: 'Completá la verificación de seguridad' })
  captchaToken?: string;
}
