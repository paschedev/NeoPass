import { IsNumber, Max, MaxLength, Min } from 'class-validator';
import { MAX_AMOUNT } from '../../common/amounts';
import { RequiredText } from '../../common/required-text.decorator';

export class PresetDto {
  @RequiredText('El nombre de la plantilla es obligatorio')
  @MaxLength(20, {
    message: 'El nombre de la plantilla puede tener hasta 20 caracteres',
  })
  name: string;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(MAX_AMOUNT, { message: 'El precio máximo es $99.999.999,99' })
  price: number;
}
