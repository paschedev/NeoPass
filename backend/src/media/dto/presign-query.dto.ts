import { IsOptional, IsUUID } from 'class-validator';

export class PresignQueryDto {
  // The event whose flyer changes; without it, the flyer of a new event.
  @IsOptional()
  @IsUUID('all', { message: 'El evento no es válido' })
  eventId?: string;
}
