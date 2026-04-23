import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentActor } from '../../modules/auth/current-actor.decorator';
import type { AuthenticatedInternalActor } from '../../modules/auth/auth.types';
import { InternalAuthGuard } from '../../modules/auth/internal-auth.guard';
import { OrganizationPermissions } from '../../modules/auth/organization-policy.decorator';
import { OrganizationPolicyGuard } from '../../modules/auth/organization-policy.guard';
import { EmitWebhookEventDto } from './dto/emit-webhook-event.dto';
import { EmitWebhookEventResponseDto } from './dto/emit-webhook-event-response.dto';
import { GetWebhookEndpointsQueryDto } from './dto/get-webhook-endpoints-query.dto';
import { ListWebhookDeliveriesQueryDto } from './dto/list-webhook-deliveries-query.dto';
import { ReplayWebhookDeliveryDto } from './dto/replay-webhook-delivery.dto';
import { RegisterWebhookEndpointDto } from './dto/register-webhook-endpoint.dto';
import {
  WebhookDeliveryListResponseDto,
  WebhookDeliveryResponseDto,
} from './dto/webhook-delivery-response.dto';
import {
  WebhookEndpointListResponseDto,
  WebhookEndpointResponseDto,
} from './dto/webhook-endpoint-response.dto';
import { WebhookService } from './webhook.service';

@ApiTags('Webhooks')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({
  description: 'User does not have organization-level access to this resource.',
})
@UseGuards(InternalAuthGuard, OrganizationPolicyGuard)
@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @ApiOperation({ summary: 'List registered webhook endpoints.' })
  @ApiOkResponse({ type: WebhookEndpointListResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('webhooks.read')
  @Get('endpoints')
  async listEndpoints(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Query() query: GetWebhookEndpointsQueryDto,
  ) {
    const endpoints = await this.webhookService.listEndpoints(
      actor.organization.id,
    );

    return {
      data: endpoints.map((endpoint) =>
        this.webhookService.sanitizeEndpoint(endpoint),
      ),
    };
  }

  @ApiOperation({
    summary: 'Register a webhook endpoint and its event subscriptions.',
  })
  @ApiCreatedResponse({ type: WebhookEndpointResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('webhooks.write')
  @Post('endpoints')
  async registerEndpoint(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: RegisterWebhookEndpointDto,
  ) {
    const endpoint = await this.webhookService.registerEndpoint({
      organizationId: actor.organization.id,
      actorUserId: actor.user.id,
      url: body.url,
      secret: body.secret,
      subscribedEvents: body.subscribedEvents ?? [],
    });

    return {
      data: this.webhookService.sanitizeEndpoint(endpoint),
    };
  }

  @ApiOperation({
    summary: 'Emit a typed webhook event to matching endpoints.',
  })
  @ApiCreatedResponse({ type: EmitWebhookEventResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('webhooks.write')
  @Post('events')
  async emitEvent(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: EmitWebhookEventDto,
  ) {
    const result = await this.webhookService.emitEvent(
      body.eventType,
      body.payload ?? {},
      actor.organization.id,
      actor.user.id,
    );

    return {
      data: result,
    };
  }
}

@ApiTags('Webhooks')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({
  description: 'User does not have organization-level access to this resource.',
})
@UseGuards(InternalAuthGuard, OrganizationPolicyGuard)
@Controller('v1/webhook-deliveries')
export class WebhookDeliveriesController {
  constructor(private readonly webhookService: WebhookService) {}

  @ApiOperation({
    summary: 'List recent webhook delivery attempts for an organization.',
  })
  @ApiOkResponse({ type: WebhookDeliveryListResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('webhooks.read')
  @Get()
  async listDeliveries(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Query() query: ListWebhookDeliveriesQueryDto,
  ) {
    const deliveries = await this.webhookService.listDeliveries({
      organizationId: actor.organization.id,
      endpointId: query.endpointId,
      status: query.status,
    });

    return {
      data: deliveries.map((delivery) =>
        this.webhookService.serializeDelivery(delivery),
      ),
    };
  }

  @ApiOperation({
    summary: 'Replay a failed or historical webhook delivery attempt.',
  })
  @ApiCreatedResponse({ type: WebhookDeliveryResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Webhook delivery not found.' })
  @OrganizationPermissions('webhooks.write')
  @Post(':id/replay')
  async replayDelivery(
    @Param('id') deliveryId: string,
    @Body() body: ReplayWebhookDeliveryDto,
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    const delivery = await this.webhookService.replayDelivery(deliveryId, {
      organizationId: actor.organization.id,
      actorUserId: actor.user.id,
    });

    return {
      data: this.webhookService.serializeDelivery(delivery),
    };
  }
}
