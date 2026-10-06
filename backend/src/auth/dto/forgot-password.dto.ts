import { EmailField } from '../../common/email-field.decorator';

export class ForgotPasswordDto {
  @EmailField()
  email: string;
}
