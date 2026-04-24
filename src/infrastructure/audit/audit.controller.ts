import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
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
import { AuditLogService } from './audit-log.service';
import { ListAuditEventsQueryDto } from './dto/list-audit-events-query.dto';
import { AuditEventListResponseDto } from './dto/audit-event-response.dto';

@ApiTags('Audit')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({
  description: 'User does not have organization-level access to this resource.',
})
@UseGuards(InternalAuthGuard, OrganizationPolicyGuard)
@Controller('v1/audit-events')
export class AuditEventsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @ApiOperation({
    summary: 'List organization audit events with security-context filters.',
  })
  @ApiOkResponse({ type: AuditEventListResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('audit.read')
  @Get()
  async listEvents(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Query() query: ListAuditEventsQueryDto,
  ): Promise<AuditEventListResponseDto> {
    return {
      data: await this.auditLogService.listEvents(actor.organization.id, {
        action: query.action,
        actorId: query.actorId,
        authSurface: query.authSurface,
        beforeCreatedAt: query.beforeCreatedAt,
        category: query.category,
        channel: query.channel,
        impersonatorActorId: query.impersonatorActorId,
        impersonatorSessionId: query.impersonatorSessionId,
        limit: query.limit,
        resourceId: query.resourceId,
        resourceType: query.resourceType,
        sessionId: query.sessionId,
        workspaceId: query.workspaceId,
      }),
    };
  }
}