import { IsString } from 'class-validator';
import { EmailField } from '../../common/email-field.decorator';

export class ChangeEmailDto {
  @EmailField()
  newEmail: string;

  @IsString({ message: 'La contraseña debe ser un texto' })
  password: string;
}
