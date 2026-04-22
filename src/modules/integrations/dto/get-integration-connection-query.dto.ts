import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GetIntegrationConnectionQueryDto {
  @ApiProperty({ example: 'org_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId!: string;
}