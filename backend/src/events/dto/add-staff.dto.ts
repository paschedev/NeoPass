import { IsString, IsIn, IsNumber, ValidateIf } from 'class-validator';
import { StaffRole, CommissionType } from '@prisma/client';

export class AddStaffDto {
  @IsString({ message: 'Elegí a quién invitar' })
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
  commissionValue?: number;
}
