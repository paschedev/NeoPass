import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString({
    message: 'El link para cambiar la contraseña no es válido o venció',
  })
  token: string;

  @IsString({ message: 'La nueva contraseña debe ser un texto' })
  @MinLength(8, {
    message: 'La nueva contraseña tiene que tener al menos 8 caracteres',
  })
  newPassword: string;
}
