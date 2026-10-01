import {
  IsString,
  IsIn,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { StaffRole, CommissionType } from '@prisma/client';
import { MAX_AMOUNT } from '../../common/amounts';

export class AddStaffDto {
  @IsUUID('all', { message: 'Elegí a quién invitar' })
  userId: string;

  @IsString()
  @IsIn(['MANAGER', 'SCANNER', 'PROMOTER'])
  role: StaffRole;

  @ValidateIf((o) => o.role === 'PROMOTER')
  @IsString({
    message: 'El tipo de comisión es obligatorio para los promotores',
  })
  @IsIn(['PERCENTAGE', 'FIXED'])
  commissionType?: CommissionType;

  @ValidateIf((o) => o.role === 'PROMOTER')
  @IsNumber(
    {},
    { message: 'El valor de la comisión es obligatorio para los promotores' },
  )
  @Min(0, { message: 'La comisión no puede ser negativa' })
  // A percentage has its own cap (100), which the service checks.
  @Max(MAX_AMOUNT, { message: 'La comisión máxima es $99.999.999,99' })
  commissionValue?: number;
}
