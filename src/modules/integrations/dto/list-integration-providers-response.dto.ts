import { ApiProperty } from '@nestjs/swagger';
import { INTEGRATION_AUTH_TYPE_VALUES, INTEGRATION_PROVIDER_KEY_VALUES } from '../../../common/integrations/integration-types';
import { INTEGRATION_PROVIDER_CATEGORY_VALUES } from '../integrations.constants';

export class IntegrationProviderListItemDto {
  @ApiProperty({
    enum: INTEGRATION_PROVIDER_KEY_VALUES,
    enumName: 'IntegrationProviderKey',
    example: 'whatsapp_cloud_api',
  })
  key!: (typeof INTEGRATION_PROVIDER_KEY_VALUES)[number];

  @ApiProperty({ example: 'WhatsApp Business Platform (Cloud API)' })
  displayName!: string;

  @ApiProperty({
    enum: INTEGRATION_PROVIDER_CATEGORY_VALUES,
    enumName: 'IntegrationProviderCategory',
    example: 'messaging',
  })
  category!: (typeof INTEGRATION_PROVIDER_CATEGORY_VALUES)[number];

  @ApiProperty({
    enum: INTEGRATION_AUTH_TYPE_VALUES,
    enumName: 'IntegrationAuthType',
    example: 'bearer_token',
  })
  authType!: (typeof INTEGRATION_AUTH_TYPE_VALUES)[number];

  @ApiProperty({ example: true })
  supportsConnectionTesting!: boolean;

  @ApiProperty({ example: true })
  supportsManualSync!: boolean;
}

export class ListIntegrationProvidersResponseDto {
  @ApiProperty({ type: () => IntegrationProviderListItemDto, isArray: true })
  data!: IntegrationProviderListItemDto[];
}