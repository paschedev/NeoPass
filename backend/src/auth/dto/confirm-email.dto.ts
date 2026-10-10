import { Matches } from 'class-validator';

export class ConfirmEmailDto {
  @Matches(/^\d{6}$/, { message: 'El código tiene 6 números' })
  code: string;
}
