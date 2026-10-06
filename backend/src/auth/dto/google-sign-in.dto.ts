import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// What the "Continuar con Google" button returns: a credential signed by Google.
export class GoogleSignInDto {
  @IsString({ message: 'Falta la credencial de Google' })
  @IsNotEmpty({ message: 'Falta la credencial de Google' })
  @MaxLength(4096, { message: 'La credencial de Google no es válida' })
  credential: string;
}
