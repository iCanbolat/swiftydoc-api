import { ApiProperty } from '@nestjs/swagger';

export class EmitWebhookEventResponseDataDto {
  @ApiProperty({ example: 'e93cb9f6-2c97-4f6a-9bd6-303231c9404f' })
  eventId!: string;

  @ApiProperty({ example: 2 })
  deliveredTo!: number;
}

export class EmitWebhookEventResponseDto {
  @ApiProperty({ type: () => EmitWebhookEventResponseDataDto })
  data!: EmitWebhookEventResponseDataDto;
}
