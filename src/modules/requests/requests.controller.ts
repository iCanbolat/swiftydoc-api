import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CreatePortalLinkDto } from './dto/create-portal-link.dto';
import { CreatePortalLinkResponseDto } from './dto/create-portal-link-response.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateRequestResponseDto } from './dto/create-request-response.dto';
import { TransitionRequestDto } from './dto/transition-request.dto';
import { TransitionRequestResponseDto } from './dto/transition-request-response.dto';
import { RequestWorkflowService } from './request-workflow.service';

@ApiTags('Requests')
@Controller('v1/requests')
export class RequestsController {
  constructor(
    private readonly requestWorkflowService: RequestWorkflowService,
  ) {}

  @ApiOperation({ summary: 'Create a draft request and optional submissions.' })
  @ApiCreatedResponse({ type: CreateRequestResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @Post()
  async createRequest(@Body() body: CreateRequestDto) {
    const request = await this.requestWorkflowService.createRequest({
      organizationId: body.organizationId,
      workspaceId: body.workspaceId,
      clientId: body.clientId,
      templateId: body.templateId,
      templateVersionId: body.templateVersionId,
      title: body.title,
      message: body.message,
      dueAt: body.dueAt,
      requestCode: body.requestCode,
      createdByUserId: body.createdByUserId,
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
  @Post(':id/send')
  async sendRequest(
    @Param('id') requestId: string,
    @Body() body: TransitionRequestDto,
  ) {
    const request = await this.requestWorkflowService.transitionRequestStatus(
      requestId,
      'send',
      {
        organizationId: body.organizationId,
        actorUserId: body.actorUserId,
        reason: body.reason,
      },
    );

    return {
      data: request,
    };
  }

  @ApiOperation({ summary: 'Close a sent or in-progress request.' })
  @ApiCreatedResponse({ type: TransitionRequestResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiConflictResponse({
    description: 'Transition is not allowed for this status.',
  })
  @ApiNotFoundResponse({ description: 'Request not found.' })
  @Post(':id/close')
  async closeRequest(
    @Param('id') requestId: string,
    @Body() body: TransitionRequestDto,
  ) {
    const request = await this.requestWorkflowService.transitionRequestStatus(
      requestId,
      'close',
      {
        organizationId: body.organizationId,
        actorUserId: body.actorUserId,
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
  @Post(':id/reopen')
  async reopenRequest(
    @Param('id') requestId: string,
    @Body() body: TransitionRequestDto,
  ) {
    const request = await this.requestWorkflowService.transitionRequestStatus(
      requestId,
      'reopen',
      {
        organizationId: body.organizationId,
        actorUserId: body.actorUserId,
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
  @Post(':id/portal-links')
  async createPortalLink(
    @Param('id') requestId: string,
    @Body() body: CreatePortalLinkDto,
    @Req() req: Request,
  ) {
    const portalLink = await this.requestWorkflowService.createPortalLink(
      requestId,
      {
        organizationId: body.organizationId,
        purpose: body.purpose,
        submissionId: body.submissionId,
        recipientId: body.recipientId,
        expiresInMinutes: body.expiresInMinutes,
        maxUses: body.maxUses,
        createdByUserId: body.createdByUserId,
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
