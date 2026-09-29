import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'La contraseña actual debe ser un texto' })
  oldPassword: string;

  @IsString({ message: 'La nueva contraseña debe ser un texto' })
  @MinLength(8, {
    message: 'La nueva contraseña tiene que tener al menos 8 caracteres',
  })
  newPassword: string;
}
