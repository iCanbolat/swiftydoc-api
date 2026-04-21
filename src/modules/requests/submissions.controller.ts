import { Body, Controller, Param, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AutosaveSubmissionAnswersDto } from './dto/autosave-submission.dto';
import { AutosaveSubmissionResponseDto } from './dto/autosave-submission-response.dto';
import { RequestWorkflowService } from './request-workflow.service';

@ApiTags('Submissions')
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
  @Patch(':id/answers')
  async autosaveAnswers(
    @Param('id') submissionId: string,
    @Body() body: AutosaveSubmissionAnswersDto,
  ) {
    const updatedSubmission =
      await this.requestWorkflowService.autosaveSubmissionAnswers(
        submissionId,
        {
          organizationId: body.organizationId,
          answers: body.answers,
          answeredByType: body.answeredByType ?? 'recipient',
          answeredById: body.answeredById,
          source: body.source ?? 'portal',
        },
      );

    return {
      data: updatedSubmission,
    };
  }
}
