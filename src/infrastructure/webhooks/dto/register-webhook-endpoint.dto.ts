import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  WEBHOOK_SUBSCRIPTION_TYPES,
  type WebhookSubscriptionType,
} from '../../../common/webhooks/webhook-events';

export class RegisterWebhookEndpointDto {
  @ApiProperty({ example: 'https://partner.example.com/hooks/swiftydoc' })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true, require_tld: false })
  url!: string;

  @ApiProperty({ minLength: 8, example: 'super-secret-token' })
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  secret!: string;

  @ApiPropertyOptional({
    enum: WEBHOOK_SUBSCRIPTION_TYPES,
    enumName: 'WebhookSubscriptionType',
    isArray: true,
    example: ['file.uploaded', 'request.completed'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(WEBHOOK_SUBSCRIPTION_TYPES, { each: true })
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  subscribedEvents?: WebhookSubscriptionType[];
}
