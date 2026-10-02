import { ValidateIf } from 'class-validator';

// For edits where a field may be left out but not cleared: unlike @IsOptional,
// which skips validation for null too, this only skips a missing field, so a
// null runs the field's validators and is rejected with their message.
export const NotNullIfSent = () =>
  ValidateIf((_object, value: unknown) => value !== undefined);
