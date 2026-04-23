import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedInternalActor } from '../auth/auth.types';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { WorkspaceAccess } from '../auth/workspace-access.decorator';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard';
import { AutosaveSubmissionAnswersDto } from './dto/autosave-submission.dto';
import { AutosaveSubmissionResponseDto } from './dto/autosave-submission-response.dto';
import { RequestWorkflowService } from './request-workflow.service';

@ApiTags('Submissions')
@ApiBearerAuth('bearer')
@UseGuards(InternalAuthGuard, WorkspaceMembershipGuard)
@Controller('v1/submissions')
export class SubmissionsController {
  constructor(
    private readonly requestWorkflowService: RequestWorkflowService,
  ) {}

  @ApiOperation({
    summary: 'Autosave answers and recompute submission progress.',
  })
  @ApiOkResponse({ type: AutosaveSubmissionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Submission not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'submission', source: 'param' })
  @Patch(':id/answers')
  async autosaveAnswers(
    @Param('id') submissionId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: AutosaveSubmissionAnswersDto,
  ) {
    const updatedSubmission =
      await this.requestWorkflowService.autosaveSubmissionAnswers(
        submissionId,
        {
          organizationId: actor.organization.id,
          answers: body.answers,
          answeredByType: 'user',
          answeredById: actor.user.id,
          source: 'api',
        },
      );

    return {
      data: updatedSubmission,
    };
  }
}
