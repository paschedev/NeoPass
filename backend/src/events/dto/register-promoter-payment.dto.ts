import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_AMOUNT } from '../../common/amounts';

export class RegisterPromoterPaymentDto {
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto tiene que ser un número con hasta dos decimales' },
  )
  @Min(0.01, { message: 'El monto tiene que ser mayor a 0' })
  @Max(MAX_AMOUNT, { message: 'El monto máximo es $99.999.999,99' })
  amount: number;

  // How it was paid ("Transferencia", "Efectivo"); optional.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString({ message: 'La nota no es válida' })
  @MaxLength(100, { message: 'La nota puede tener hasta 100 caracteres' })
  note?: string | null;
}
