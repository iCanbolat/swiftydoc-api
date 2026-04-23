import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
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
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedInternalActor } from '../auth/auth.types';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { WorkspaceAccess } from '../auth/workspace-access.decorator';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard';
import { CreateSubmissionItemCommentDto } from './dto/create-submission-item-comment.dto';
import { CreateSubmissionItemCommentResponseDto } from './dto/create-submission-item-comment-response.dto';
import { ReviewSubmissionItemResponseDto } from './dto/review-submission-item-response.dto';
import { ReviewSubmissionItemDto } from './dto/review-submission-item.dto';
import { RequestWorkflowService } from './request-workflow.service';

@ApiTags('Reviews')
@ApiBearerAuth('bearer')
@UseGuards(InternalAuthGuard, WorkspaceMembershipGuard)
@Controller('v1/reviews')
export class ReviewsController {
  constructor(
    private readonly requestWorkflowService: RequestWorkflowService,
  ) {}

  @ApiOperation({ summary: 'Approve a submission item.' })
  @ApiCreatedResponse({ type: ReviewSubmissionItemResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiConflictResponse({
    description: 'Submission item cannot be approved from its current status.',
  })
  @ApiNotFoundResponse({ description: 'Submission item not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({
    key: 'itemId',
    resource: 'submissionItem',
    source: 'param',
  })
  @Post(':itemId/approve')
  async approveItem(
    @Param('itemId') itemId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: ReviewSubmissionItemDto,
  ) {
    const result = await this.requestWorkflowService.approveSubmissionItem(
      itemId,
      {
        organizationId: actor.organization.id,
        reviewerId: actor.user.id,
        note: body.note,
        metadata: body.metadata,
      },
    );

    return {
      data: result,
    };
  }

  @ApiOperation({ summary: 'Reject a submission item.' })
  @ApiCreatedResponse({ type: ReviewSubmissionItemResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiConflictResponse({
    description: 'Submission item cannot be rejected from its current status.',
  })
  @ApiNotFoundResponse({ description: 'Submission item not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({
    key: 'itemId',
    resource: 'submissionItem',
    source: 'param',
  })
  @Post(':itemId/reject')
  async rejectItem(
    @Param('itemId') itemId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: ReviewSubmissionItemDto,
  ) {
    const result = await this.requestWorkflowService.rejectSubmissionItem(
      itemId,
      {
        organizationId: actor.organization.id,
        reviewerId: actor.user.id,
        note: body.note,
        metadata: body.metadata,
      },
    );

    return {
      data: result,
    };
  }

  @ApiOperation({ summary: 'Create a comment on a submission item.' })
  @ApiCreatedResponse({ type: CreateSubmissionItemCommentResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Submission item not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({
    key: 'itemId',
    resource: 'submissionItem',
    source: 'param',
  })
  @Post(':itemId/comments')
  async createComment(
    @Param('itemId') itemId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: CreateSubmissionItemCommentDto,
  ) {
    const result =
      await this.requestWorkflowService.createSubmissionItemComment(itemId, {
        organizationId: actor.organization.id,
        body: body.body,
        authorType: 'reviewer',
        authorId: actor.user.id,
        metadata: body.metadata,
      });

    return {
      data: result,
    };
  }
}
