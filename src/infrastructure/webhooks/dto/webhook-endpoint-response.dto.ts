import { ApiProperty } from '@nestjs/swagger';
import {
  WEBHOOK_SUBSCRIPTION_TYPES,
  type WebhookSubscriptionType,
} from '../../../common/webhooks/webhook-events';

export class WebhookEndpointViewDto {
  @ApiProperty({ example: 'c0f59570-b40a-47ba-b0a0-3ebd0cd54b70' })
  id!: string;

  @ApiProperty({ example: 'https://partner.example.com/hooks/swiftydoc' })
  url!: string;

  @ApiProperty({ example: '[redacted]' })
  secret!: string;

  @ApiProperty({
    enum: WEBHOOK_SUBSCRIPTION_TYPES,
    enumName: 'WebhookSubscriptionType',
    isArray: true,
    example: ['file.uploaded', 'request.completed'],
  })
  subscribedEvents!: WebhookSubscriptionType[];

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: '2026-04-21T09:15:00.000Z' })
  createdAt!: string;
}

export class WebhookEndpointResponseDto {
  @ApiProperty({ type: () => WebhookEndpointViewDto })
  data!: WebhookEndpointViewDto;
}

export class WebhookEndpointListResponseDto {
  @ApiProperty({ type: () => WebhookEndpointViewDto, isArray: true })
  data!: WebhookEndpointViewDto[];
}
