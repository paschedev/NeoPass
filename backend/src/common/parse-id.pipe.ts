import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';

// Every id is a UUID: a malformed one can't belong to any row, so it gets the
// answer of a missing resource without querying the database.
export const ParseIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException('No encontramos lo que buscás'),
});
