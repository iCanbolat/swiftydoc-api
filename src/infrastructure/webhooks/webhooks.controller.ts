import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { EmitWebhookEventDto } from './dto/emit-webhook-event.dto';
import { EmitWebhookEventResponseDto } from './dto/emit-webhook-event-response.dto';
import { RegisterWebhookEndpointDto } from './dto/register-webhook-endpoint.dto';
import {
  WebhookEndpointListResponseDto,
  WebhookEndpointResponseDto,
} from './dto/webhook-endpoint-response.dto';
import { WebhookService } from './webhook.service';

@ApiTags('Webhooks')
@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @ApiOperation({ summary: 'List registered webhook endpoints.' })
  @ApiOkResponse({ type: WebhookEndpointListResponseDto })
  @Get('endpoints')
  listEndpoints() {
    return {
      data: this.webhookService.listEndpoints().map((endpoint) => ({
        ...endpoint,
        secret: '[redacted]',
      })),
    };
  }

  @ApiOperation({
    summary: 'Register a webhook endpoint and its event subscriptions.',
  })
  @ApiCreatedResponse({ type: WebhookEndpointResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @Post('endpoints')
  registerEndpoint(@Body() body: RegisterWebhookEndpointDto) {
    const endpoint = this.webhookService.registerEndpoint({
      url: body.url,
      secret: body.secret,
      subscribedEvents: body.subscribedEvents ?? [],
    });

    return {
      data: {
        ...endpoint,
        secret: '[redacted]',
      },
    };
  }

  @ApiOperation({
    summary: 'Emit a typed webhook event to matching endpoints.',
  })
  @ApiCreatedResponse({ type: EmitWebhookEventResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @Post('events')
  async emitEvent(@Body() body: EmitWebhookEventDto) {
    const result = await this.webhookService.emitEvent(
      body.eventType,
      body.payload ?? {},
      body.organizationId,
    );

    return {
      data: result,
    };
  }
}
