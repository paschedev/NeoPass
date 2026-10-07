import { IsNumber, Max, Min } from 'class-validator';

export class UpdateServiceFeeDto {
  // A JSON number: "8" or "" as text are rejected instead of becoming 8 or 0.
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'El cargo tiene que ser un número con hasta 2 decimales' },
  )
  @Min(0, { message: 'El cargo no puede ser negativo' })
  @Max(100, { message: 'El cargo puede ser de hasta 100 %' })
  percentage: number;
}
