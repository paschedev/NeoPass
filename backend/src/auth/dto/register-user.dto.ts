import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  ValidateIf,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';

export class RegisterUserDto {
  @IsString({ message: 'El nombre debe ser un texto' })
  firstName: string;

  @IsString({ message: 'El apellido debe ser un texto' })
  lastName: string;

  @IsEmail({}, { message: 'Debe ser un correo electrónico válido' })
  email: string;

  @IsString({ message: 'La contraseña debe ser un texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(32, {
    message: 'La contraseña no puede tener más de 32 caracteres',
  })
  password: string;

  // ADMIN is never self-assigned.
  @IsString({ message: 'El rol debe ser un texto' })
  @IsIn(['CUSTOMER', 'ORGANIZER'], {
    message: 'El rol proporcionado no es válido',
  })
  role: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;

  // Organizer specific fields
  @ValidateIf((o) => o.role === 'ORGANIZER')
  @IsString({ message: 'El teléfono debe ser un texto' })
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message:
      'El número de teléfono debe tener formato internacional (ej: +549112345678)',
  })
  phone: string;

  @ValidateIf((o) => o.role === 'ORGANIZER')
  @IsOptional()
  @IsString({ message: 'El nombre de la productora debe ser un texto' })
  companyName?: string;
}
