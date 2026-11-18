import {
  Equals,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CURRENT_LEGAL_VERSIONS } from '../../legal/legal-documents';

const TERMS_MESSAGE =
  'Aceptá la versión vigente de los Términos de uso y la Política de privacidad';

// What the "Continuar con Google" button returns: a credential signed by Google.
export class GoogleCredentialDto {
  @IsString({ message: 'Falta la credencial de Google' })
  @IsNotEmpty({ message: 'Falta la credencial de Google' })
  @MaxLength(4096, { message: 'La credencial de Google no es válida' })
  credential: string;
}

// Creating an account also takes the legal versions accepted in the sign-up
// box; entering an existing account doesn't need them.
export class GoogleSignInDto extends GoogleCredentialDto {
  @IsOptional()
  @Equals(CURRENT_LEGAL_VERSIONS.TERMS, { message: TERMS_MESSAGE })
  termsVersion?: number;

  @IsOptional()
  @Equals(CURRENT_LEGAL_VERSIONS.PRIVACY, { message: TERMS_MESSAGE })
  privacyVersion?: number;
}
