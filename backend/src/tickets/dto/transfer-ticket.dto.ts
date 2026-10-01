import { IsString } from 'class-validator';

export class TransferTicketDto {
  @IsString({ message: 'Elegí a quién transferir la entrada' })
  targetUserId: string;
}
