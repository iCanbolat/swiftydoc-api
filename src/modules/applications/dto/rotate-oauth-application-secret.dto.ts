import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RotateOAuthApplicationSecretDto {
  @ApiPropertyOptional({
    example: 'Owner-approved rotation for quarterly secret hygiene.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
