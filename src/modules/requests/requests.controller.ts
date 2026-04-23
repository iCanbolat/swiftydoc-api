import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedInternalActor } from '../auth/auth.types';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { WorkspaceAccess } from '../auth/workspace-access.decorator';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard';
import { CreatePortalLinkDto } from './dto/create-portal-link.dto';
import { CreatePortalLinkResponseDto } from './dto/create-portal-link-response.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateRequestResponseDto } from './dto/create-request-response.dto';
import { SendRequestReminderDto } from './dto/send-request-reminder.dto';
import { SendRequestReminderResponseDto } from './dto/send-request-reminder-response.dto';
import { TransitionRequestDto } from './dto/transition-request.dto';
import { TransitionRequestResponseDto } from './dto/transition-request-response.dto';
import { RequestWorkflowService } from './request-workflow.service';

@ApiTags('Requests')
@ApiBearerAuth('bearer')
@UseGuards(InternalAuthGuard, WorkspaceMembershipGuard)
@Controller('v1/requests')
export class RequestsController {
  constructor(
    private readonly requestWorkflowService: RequestWorkflowService,
  ) {}

  @ApiOperation({ summary: 'Create a draft request and optional submissions.' })
  @ApiCreatedResponse({ type: CreateRequestResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({
    key: 'workspaceId',
    resource: 'workspace',
    source: 'body',
  })
  @Post()
  async createRequest(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: CreateRequestDto,
  ) {
    const request = await this.requestWorkflowService.createRequest({
      organizationId: actor.organization.id,
      workspaceId: body.workspaceId,
      clientId: body.clientId,
      templateId: body.templateId,
      templateVersionId: body.templateVersionId,
      title: body.title,
      message: body.message,
      dueAt: body.dueAt,
      requestCode: body.requestCode,
      createdByUserId: actor.user.id,
      recipientIds: body.recipientIds ?? [],
    });

    return {
      data: request,
    };
  }

  @ApiOperation({ summary: 'Send a draft request.' })
  @ApiCreatedResponse({ type: TransitionRequestResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiConflictResponse({
    description: 'Transition is not allowed for this status.',
  })
  @ApiNotFoundResponse({ description: 'Request not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'request', source: 'param' })
  @Post(':id/send')
  async sendRequest(
    @Param('id') requestId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: TransitionRequestDto,
  ) {
    const request = await this.requestWorkflowService.transitionRequestStatus(
      requestId,
      'send',
      {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        reason: body.reason,
      },
    );

    return {
      data: request,
    };
  }

  @ApiOperation({
    summary: 'Send a reminder for a request via configured channel.',
  })
  @ApiCreatedResponse({ type: SendRequestReminderResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Request not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'request', source: 'param' })
  @Post(':id/remind')
  async sendReminder(
    @Param('id') requestId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: SendRequestReminderDto,
  ) {
    const reminder = await this.requestWorkflowService.sendRequestReminder(
      requestId,
      {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        channel: body.channel,
        recipient: body.recipient,
        subject: body.subject,
        message: body.message,
        templateKey: body.templateKey,
        templateVariables: body.templateVariables,
        locale: body.locale,
        metadata: body.metadata,
      },
    );

    return {
      data: reminder,
    };
  }

  @ApiOperation({ summary: 'Close a sent or in-progress request.' })
  @ApiCreatedResponse({ type: TransitionRequestResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiConflictResponse({
    description: 'Transition is not allowed for this status.',
  })
  @ApiNotFoundResponse({ description: 'Request not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'request', source: 'param' })
  @Post(':id/close')
  async closeRequest(
    @Param('id') requestId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: TransitionRequestDto,
  ) {
    const request = await this.requestWorkflowService.transitionRequestStatus(
      requestId,
      'close',
      {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        reason: body.reason,
      },
    );

    return {
      data: request,
    };
  }

  @ApiOperation({ summary: 'Reopen a closed request.' })
  @ApiCreatedResponse({ type: TransitionRequestResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiConflictResponse({
    description: 'Transition is not allowed for this status.',
  })
  @ApiNotFoundResponse({ description: 'Request not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'request', source: 'param' })
  @Post(':id/reopen')
  async reopenRequest(
    @Param('id') requestId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: TransitionRequestDto,
  ) {
    const request = await this.requestWorkflowService.transitionRequestStatus(
      requestId,
      'reopen',
      {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        reason: body.reason,
      },
    );

    return {
      data: request,
    };
  }

  @ApiOperation({ summary: 'Create a secure portal link for a request.' })
  @ApiCreatedResponse({ type: CreatePortalLinkResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Request not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'request', source: 'param' })
  @Post(':id/portal-links')
  async createPortalLink(
    @Param('id') requestId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: CreatePortalLinkDto,
    @Req() req: Request,
  ) {
    const portalLink = await this.requestWorkflowService.createPortalLink(
      requestId,
      {
        organizationId: actor.organization.id,
        purpose: body.purpose,
        submissionId: body.submissionId,
        recipientId: body.recipientId,
        expiresInMinutes: body.expiresInMinutes,
        maxUses: body.maxUses,
        createdByUserId: actor.user.id,
        metadata: body.metadata,
      },
      this.resolveBaseUrl(req),
    );

    return {
      data: portalLink,
    };
  }

  private resolveBaseUrl(req: Request): string {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const firstForwardedProto = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto;
    const protocol = firstForwardedProto || req.protocol || 'http';

    return `${protocol}://${req.get('host')}`;
  }
}
