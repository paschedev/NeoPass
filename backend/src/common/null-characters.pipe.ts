import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

const MAX_DEPTH = 10;

function hasNullCharacter(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return value.includes('\u0000');
  if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) {
    return false;
  }
  return Object.entries(value).some(
    ([key, item]) =>
      key.includes('\u0000') || hasNullCharacter(item, depth + 1),
  );
}

// Postgres can't store a NUL character in a text column: without this, any text
// with one ends in a 500 instead of telling the client what is wrong. Route IDs
// are left to ParseIdPipe, which answers that the resource doesn't exist.
@Injectable()
export class NullCharactersPipe implements PipeTransform {
  transform(value: unknown, { type }: ArgumentMetadata) {
    if ((type === 'body' || type === 'query') && hasNullCharacter(value)) {
      throw new BadRequestException('El texto tiene caracteres no válidos');
    }
    return value;
  }
}
