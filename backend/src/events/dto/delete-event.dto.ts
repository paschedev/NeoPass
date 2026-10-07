import { IsEmail, IsOptional, MaxLength } from 'class-validator';

export class DeleteEventDto {
  // Where buyers can write after the deletion; without it, the email of the
  // organizer's account. Only the organizer chooses it.
  @IsOptional()
  @IsEmail({}, { message: 'Escribí un email de contacto válido' })
  @MaxLength(254, { message: 'El email de contacto es demasiado largo' })
  contactEmail?: string;
}
