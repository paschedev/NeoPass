import { IsString, IsIn, IsNumber, ValidateIf } from 'class-validator';
import { StaffRole, CommissionType } from '@prisma/client';

export class AddStaffDto {
  @IsString({ message: 'El ID de usuario es requerido' })
  userId: string;

  @IsString()
  @IsIn(['MANAGER', 'SCANNER', 'PROMOTER'])
  role: StaffRole;

  @ValidateIf((o) => o.role === 'PROMOTER')
  @IsString({ message: 'El tipo de comisión es requerido para RPPs' })
  @IsIn(['PERCENTAGE', 'FIXED'])
  commissionType?: CommissionType;

  @ValidateIf((o) => o.role === 'PROMOTER')
  @IsNumber({}, { message: 'El valor de la comisión es requerido para RPPs' })
  commissionValue?: number;
}
