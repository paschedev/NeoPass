import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString({ message: 'El token es requerido' })
  token: string;

  @IsString({ message: 'La nueva contraseña debe ser un texto' })
  @MinLength(8, {
    message: 'La nueva contraseña tiene que tener al menos 8 caracteres',
  })
  newPassword: string;
}
