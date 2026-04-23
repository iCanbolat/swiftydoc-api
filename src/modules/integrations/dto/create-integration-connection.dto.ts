import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  INTEGRATION_AUTH_TYPE_VALUES,
  INTEGRATION_PROVIDER_KEY_VALUES,
  type IntegrationAuthType,
  type IntegrationProviderKey,
} from '../../../common/integrations/integration-types';

export class CreateIntegrationConnectionDto {
  @ApiPropertyOptional({ example: 'workspace_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  workspaceId?: string;

  @ApiProperty({
    enum: INTEGRATION_PROVIDER_KEY_VALUES,
    enumName: 'IntegrationProviderKey',
    example: 'whatsapp_cloud_api',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(INTEGRATION_PROVIDER_KEY_VALUES)
  providerKey!: IntegrationProviderKey;

  @ApiPropertyOptional({
    enum: INTEGRATION_AUTH_TYPE_VALUES,
    enumName: 'IntegrationAuthType',
    example: 'bearer_token',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(INTEGRATION_AUTH_TYPE_VALUES)
  authType?: IntegrationAuthType;

  @ApiPropertyOptional({ example: 'vault://org_123/whatsapp', maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  credentialsRef?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      phoneNumberId: '1234567890',
      accessToken: 'EAA...',
    },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      ownerTeam: 'operations',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
