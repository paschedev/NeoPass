import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

// An email typed by the user: surrounding spaces don't make it invalid. The
// database stores it in lowercase and decides which account it reaches.
export const EmailField = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsEmail({}, { message: 'Debe ser un correo electrónico válido' }),
  );
