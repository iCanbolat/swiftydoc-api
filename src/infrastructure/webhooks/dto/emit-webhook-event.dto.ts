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
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
} from '../../../common/webhooks/webhook-events';

export class EmitWebhookEventDto {
  @ApiProperty({
    enum: WEBHOOK_EVENT_TYPES,
    enumName: 'WebhookEventType',
    example: 'file.uploaded',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(WEBHOOK_EVENT_TYPES)
  @MaxLength(120)
  eventType!: WebhookEventType;

  @ApiPropertyOptional({ example: 'org_123' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      contentType: 'application/pdf',
      sizeBytes: 245760,
      storageKey: 'org_123/2026-04-21/uuid_passport.pdf',
    },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
