import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const COMMENT_AUTHOR_TYPE_VALUES = ['reviewer', 'recipient', 'system'] as const;

export class CreateSubmissionItemCommentResponseDataDto {
  @ApiProperty({ example: 'comment_123' })
  id!: string;

  @ApiProperty({ example: 'submission_item_123' })
  submissionItemId!: string;

  @ApiProperty({ example: 'submission_123' })
  submissionId!: string;

  @ApiProperty({ example: 'req_123' })
  requestId!: string;

  @ApiProperty({
    enum: COMMENT_AUTHOR_TYPE_VALUES,
    enumName: 'CommentAuthorType',
    example: 'reviewer',
  })
  authorType!: (typeof COMMENT_AUTHOR_TYPE_VALUES)[number];

  @ApiPropertyOptional({ example: 'reviewer_123', nullable: true })
  authorId!: string | null;

  @ApiProperty({ example: 'Lutfen bu alani yeniden yukleyin.' })
  body!: string;

  @ApiProperty({ example: '2026-04-22T08:30:00.000Z' })
  createdAt!: string;
}

export class CreateSubmissionItemCommentResponseDto {
  @ApiProperty({ type: () => CreateSubmissionItemCommentResponseDataDto })
  data!: CreateSubmissionItemCommentResponseDataDto;
}
