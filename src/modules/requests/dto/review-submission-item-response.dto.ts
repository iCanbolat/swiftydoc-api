import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SUBMISSION_ITEM_STATUS_VALUES,
  SUBMISSION_STATUS_VALUES,
} from '../../../common/requests/request-workflow';

const REVIEW_DECISION_VALUES = ['approved', 'rejected'] as const;

export class ReviewSubmissionItemResponseDataDto {
  @ApiProperty({ example: 'review_decision_123' })
  reviewDecisionId!: string;

  @ApiProperty({
    enum: REVIEW_DECISION_VALUES,
    enumName: 'ReviewDecisionType',
    example: 'approved',
  })
  decision!: (typeof REVIEW_DECISION_VALUES)[number];

  @ApiProperty({ example: 'submission_item_123' })
  submissionItemId!: string;

  @ApiProperty({ example: 'submission_123' })
  submissionId!: string;

  @ApiProperty({ example: 'req_123' })
  requestId!: string;

  @ApiProperty({
    enum: SUBMISSION_ITEM_STATUS_VALUES,
    enumName: 'SubmissionItemStatus',
    example: 'approved',
  })
  status!: (typeof SUBMISSION_ITEM_STATUS_VALUES)[number];

  @ApiPropertyOptional({
    example: 'Belge yeterli netlikte oldugu icin onaylandi.',
    nullable: true,
  })
  note!: string | null;

  @ApiPropertyOptional({ example: 'reviewer_123', nullable: true })
  reviewerId!: string | null;

  @ApiProperty({
    enum: SUBMISSION_STATUS_VALUES,
    enumName: 'SubmissionStatus',
    example: 'in_progress',
  })
  submissionStatus!: (typeof SUBMISSION_STATUS_VALUES)[number];

  @ApiProperty({ example: 70 })
  progressPercent!: number;

  @ApiProperty({ example: '2026-04-22T08:00:00.000Z' })
  reviewedAt!: string;
}

export class ReviewSubmissionItemResponseDto {
  @ApiProperty({ type: () => ReviewSubmissionItemResponseDataDto })
  data!: ReviewSubmissionItemResponseDataDto;
}
