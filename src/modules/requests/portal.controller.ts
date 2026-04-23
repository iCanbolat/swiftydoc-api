import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentPortalActor } from '../auth/current-portal-actor.decorator';
import { PortalAuthGuard } from '../auth/portal-auth.guard';
import type { AuthenticatedPortalActor } from '../auth/auth.types';
import { FilesService } from '../files/files.service';
import { UploadFileResponseDto } from '../files/dto/upload-file-response.dto';
import { AutosaveSubmissionResponseDto } from './dto/autosave-submission-response.dto';
import { PortalAutosaveSubmissionAnswersDto } from './dto/portal-autosave-submission.dto';
import { PortalUploadFileDto } from './dto/portal-upload-file.dto';
import { VerifyPortalLinkDto } from './dto/verify-portal-link.dto';
import { VerifyPortalLinkResponseDto } from './dto/verify-portal-link-response.dto';
import { RequestWorkflowService } from './request-workflow.service';
import { AuthService } from '../auth/auth.service';

@ApiTags('Portal')
@Controller('v1/portal')
export class PortalController {
  constructor(
    private readonly authService: AuthService,
    private readonly filesService: FilesService,
    private readonly requestWorkflowService: RequestWorkflowService,
  ) {}

  @ApiOperation({
    summary: 'Verify and optionally consume a secure portal link.',
  })
  @ApiCreatedResponse({ type: VerifyPortalLinkResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Portal link is invalid or expired.',
  })
  @Post('access')
  async verifyAccess(@Body() body: VerifyPortalLinkDto) {
    const portalAccess = await this.requestWorkflowService.verifyPortalLink({
      requestId: body.requestId,
      token: body.token,
      purpose: body.purpose,
      consume: body.consume,
    });

    const portalSession =
      body.consume === false
        ? null
        : await this.authService.issuePortalAccessToken({
            organizationId: portalAccess.organizationId,
            portalLinkId: portalAccess.portalLinkId,
            purpose: portalAccess.purpose,
            recipientId: portalAccess.recipientId,
            requestId: portalAccess.requestId,
            submissionId: portalAccess.submissionId,
          });

    return {
      data: {
        ...portalAccess,
        tokenType: portalSession?.tokenType ?? null,
        portalAccessToken: portalSession?.accessToken ?? null,
        accessTokenExpiresAt: portalSession?.expiresAt ?? null,
      },
    };
  }

  @ApiOperation({ summary: 'Autosave answers for a portal-bound submission.' })
  @ApiSecurity('portal')
  @ApiOkResponse({ type: AutosaveSubmissionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Portal access token is missing, invalid or expired.',
  })
  @ApiForbiddenResponse({
    description: 'Portal token is not bound to this submission.',
  })
  @UseGuards(PortalAuthGuard)
  @Patch('submissions/:id/answers')
  async autosaveSubmissionAnswers(
    @CurrentPortalActor() actor: AuthenticatedPortalActor,
    @Param('id') submissionId: string,
    @Body() body: PortalAutosaveSubmissionAnswersDto,
  ) {
    if (!actor.submissionId) {
      throw new ForbiddenException(
        'Portal token is not bound to a submission.',
      );
    }

    await this.requestWorkflowService.assertPortalSubmissionAccess({
      organizationId: actor.organizationId,
      recipientId: actor.recipientId,
      requestId: actor.requestId,
      submissionId,
      tokenSubmissionId: actor.submissionId,
    });

    const submission =
      await this.requestWorkflowService.autosaveSubmissionAnswers(
        submissionId,
        {
          organizationId: actor.organizationId,
          answers: body.answers,
          answeredByType: 'recipient',
          answeredById: actor.recipientId ?? undefined,
          source: 'portal',
        },
      );

    return {
      data: submission,
    };
  }

  @ApiOperation({ summary: 'Upload a file using a portal access token.' })
  @ApiSecurity('portal')
  @ApiCreatedResponse({ type: UploadFileResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Portal access token is missing, invalid or expired.',
  })
  @ApiForbiddenResponse({
    description: 'Portal token is not bound to this submission.',
  })
  @UseGuards(PortalAuthGuard)
  @Post('files/upload')
  async uploadFile(
    @CurrentPortalActor() actor: AuthenticatedPortalActor,
    @Body() body: PortalUploadFileDto,
    @Req() req: Request,
  ) {
    if (!actor.submissionId) {
      throw new ForbiddenException(
        'Portal token is not bound to a submission.',
      );
    }

    await this.requestWorkflowService.assertPortalSubmissionAccess({
      organizationId: actor.organizationId,
      recipientId: actor.recipientId,
      requestId: actor.requestId,
      submissionId: actor.submissionId,
      tokenSubmissionId: actor.submissionId,
    });

    if (body.submissionItemId) {
      await this.requestWorkflowService.assertPortalSubmissionItemAccess({
        organizationId: actor.organizationId,
        requestId: actor.requestId,
        submissionId: actor.submissionId,
        submissionItemId: body.submissionItemId,
      });
    }

    const uploaded = await this.filesService.uploadBase64File({
      fileName: body.fileName,
      contentBase64: body.contentBase64,
      contentType: body.contentType,
      organizationId: actor.organizationId,
      requestId: actor.requestId,
      submissionId: actor.submissionId,
      submissionItemId: body.submissionItemId,
      uploadedByType: 'recipient',
      uploadedById: actor.recipientId ?? undefined,
      metadata: {
        ...(body.metadata ?? {}),
        authSurface: 'portal',
        portalLinkId: actor.portalLinkId,
      },
    });

    return {
      data: {
        ...uploaded,
        downloadUrl: this.filesService.createDownloadLink(
          uploaded.storageKey,
          this.resolveBaseUrl(req),
        ),
      },
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
