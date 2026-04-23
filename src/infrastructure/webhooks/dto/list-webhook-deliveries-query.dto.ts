import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  WEBHOOK_DELIVERY_STATUS_VALUES,
  type WebhookDeliveryStatus,
} from '../../../common/webhooks/webhook-delivery-types';

export class ListWebhookDeliveriesQueryDto {
  @ApiPropertyOptional({ example: 'webhook_endpoint_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  endpointId?: string;

  @ApiPropertyOptional({
    enum: WEBHOOK_DELIVERY_STATUS_VALUES,
    enumName: 'WebhookDeliveryStatus',
    example: 'failed',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(WEBHOOK_DELIVERY_STATUS_VALUES)
  status?: WebhookDeliveryStatus;
}
