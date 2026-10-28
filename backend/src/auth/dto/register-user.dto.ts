import {
  IsString,
  MinLength,
  MaxLength,
  ValidateIf,
  IsOptional,
  IsIn,
  Matches,
  Equals,
} from 'class-validator';
import { EmailField } from '../../common/email-field.decorator';
import { NoNeoPassName } from '../../common/brand-name';
import { CURRENT_LEGAL_VERSIONS } from '../../legal/legal-documents';

const TERMS_MESSAGE =
  'Aceptá la versión vigente de los Términos de uso y la Política de privacidad';

export class RegisterUserDto {
  @IsString({ message: 'El nombre debe ser un texto' })
  @MaxLength(30, { message: 'El nombre puede tener hasta 30 caracteres' })
  @NoNeoPassName()
  firstName: string;

  @IsString({ message: 'El apellido debe ser un texto' })
  @MaxLength(30, { message: 'El apellido puede tener hasta 30 caracteres' })
  @NoNeoPassName()
  lastName: string;

  @EmailField()
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
  @IsString({ message: 'Completá la verificación de seguridad' })
  captchaToken?: string;

  // The versions of the legal texts the person accepted; a missing or older
  // one means they never saw the texts in force.
  @Equals(CURRENT_LEGAL_VERSIONS.TERMS, { message: TERMS_MESSAGE })
  termsVersion: number;

  @Equals(CURRENT_LEGAL_VERSIONS.PRIVACY, { message: TERMS_MESSAGE })
  privacyVersion: number;

  @ValidateIf((o) => o.role === 'ORGANIZER')
  @Equals(CURRENT_LEGAL_VERSIONS.ORGANIZER_TERMS, {
    message: 'Aceptá la versión vigente de los Términos para organizadores',
  })
  organizerTermsVersion?: number;

  // Organizer specific fields
  @ValidateIf((o) => o.role === 'ORGANIZER')
  @IsString({ message: 'El teléfono debe ser un texto' })
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message:
      'El número de teléfono debe tener formato internacional (ej: +549112345678)',
  })
  phone: string;

  @ValidateIf((o: RegisterUserDto) => o.role === 'ORGANIZER')
  @IsOptional()
  @IsString({ message: 'El nombre de la productora debe ser un texto' })
  @MaxLength(50, {
    message: 'El nombre de la productora puede tener hasta 50 caracteres',
  })
  @NoNeoPassName()
  companyName?: string;
}
