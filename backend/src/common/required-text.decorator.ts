import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { MinLength } from 'class-validator';

// A text the user has to fill in: it is stored without surrounding spaces and
// rejected, with a single message, when it is missing, blank or not a string.
export const RequiredText = (message: string) =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    MinLength(1, { message }),
  );
