import { IsUUID } from 'class-validator';

export class TransferTicketDto {
  @IsUUID('all', { message: 'Elegí a quién transferir la entrada' })
  targetUserId: string;
}
