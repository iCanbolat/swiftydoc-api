import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSubmissionItemCommentDto } from './dto/create-submission-item-comment.dto';
import { CreateSubmissionItemCommentResponseDto } from './dto/create-submission-item-comment-response.dto';
import { ReviewSubmissionItemResponseDto } from './dto/review-submission-item-response.dto';
import { ReviewSubmissionItemDto } from './dto/review-submission-item.dto';
import { RequestWorkflowService } from './request-workflow.service';

@ApiTags('Reviews')
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
  @Post(':itemId/approve')
  async approveItem(
    @Param('itemId') itemId: string,
    @Body() body: ReviewSubmissionItemDto,
  ) {
    const result = await this.requestWorkflowService.approveSubmissionItem(
      itemId,
      {
        organizationId: body.organizationId,
        reviewerId: body.reviewerId,
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
  @Post(':itemId/reject')
  async rejectItem(
    @Param('itemId') itemId: string,
    @Body() body: ReviewSubmissionItemDto,
  ) {
    const result = await this.requestWorkflowService.rejectSubmissionItem(
      itemId,
      {
        organizationId: body.organizationId,
        reviewerId: body.reviewerId,
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
  @Post(':itemId/comments')
  async createComment(
    @Param('itemId') itemId: string,
    @Body() body: CreateSubmissionItemCommentDto,
  ) {
    const result = await this.requestWorkflowService.createSubmissionItemComment(
      itemId,
      {
        organizationId: body.organizationId,
        body: body.body,
        authorType: body.authorType ?? 'reviewer',
        authorId: body.authorId,
        metadata: body.metadata,
      },
    );

    return {
      data: result,
    };
  }
}
