import { IsInt, Max, Min, ValidateIf } from 'class-validator';

const LIMIT_MESSAGE =
  'El tope de QR free tiene que ser un número entero mayor a 0';

export class UpdatePromoterFreeTicketsDto {
  // How many free tickets the promoter can send; null takes it away. It has
  // to come: a missing value is not "no limit".
  @ValidateIf((o: UpdatePromoterFreeTicketsDto) => o.freeTicketLimit !== null)
  @IsInt({ message: LIMIT_MESSAGE })
  @Min(1, { message: LIMIT_MESSAGE })
  @Max(100_000, { message: 'El tope de QR free máximo es 100.000' })
  freeTicketLimit: number | null;
}
