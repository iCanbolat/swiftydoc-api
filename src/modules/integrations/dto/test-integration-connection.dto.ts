import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class TestIntegrationConnectionDto {
  @ApiProperty({ example: 'org_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId!: string;

  @ApiPropertyOptional({ example: 'user_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  actorUserId?: string;
}