import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  INTEGRATION_AUTH_TYPE_VALUES,
  INTEGRATION_CONNECTION_STATUS_VALUES,
  INTEGRATION_PROVIDER_KEY_VALUES,
} from '../../../common/integrations/integration-types';

export class IntegrationConnectionDataDto {
  @ApiProperty({ example: 'integration_connection_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiPropertyOptional({ example: 'workspace_123', nullable: true })
  workspaceId!: string | null;

  @ApiProperty({
    enum: INTEGRATION_PROVIDER_KEY_VALUES,
    enumName: 'IntegrationProviderKey',
    example: 'whatsapp_cloud_api',
  })
  providerKey!: (typeof INTEGRATION_PROVIDER_KEY_VALUES)[number];

  @ApiProperty({
    enum: INTEGRATION_AUTH_TYPE_VALUES,
    enumName: 'IntegrationAuthType',
    example: 'bearer_token',
  })
  authType!: (typeof INTEGRATION_AUTH_TYPE_VALUES)[number];

  @ApiPropertyOptional({ example: 'vault://org_123/whatsapp', nullable: true })
  credentialsRef!: string | null;

  @ApiProperty({
    enum: INTEGRATION_CONNECTION_STATUS_VALUES,
    enumName: 'IntegrationConnectionStatus',
    example: 'pending',
  })
  status!: (typeof INTEGRATION_CONNECTION_STATUS_VALUES)[number];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      phoneNumberId: '[redacted]',
      accessToken: '[redacted]',
    },
  })
  settings!: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      region: 'mena',
    },
  })
  metadata!: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true, example: null })
  errorMessage!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-04-22T14:00:00.000Z' })
  lastTestedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-04-22T14:02:00.000Z' })
  lastSyncedAt!: string | null;

  @ApiProperty({ example: '2026-04-22T13:55:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-22T13:55:00.000Z' })
  updatedAt!: string;
}

export class IntegrationConnectionResponseDto {
  @ApiProperty({ type: () => IntegrationConnectionDataDto })
  data!: IntegrationConnectionDataDto;
}