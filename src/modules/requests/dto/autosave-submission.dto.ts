import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ANSWERED_BY_TYPE_VALUES = ['recipient', 'reviewer', 'system'] as const;
const ANSWER_SOURCE_VALUES = ['portal', 'api'] as const;

export class AutosaveAnswerInputDto {
  @ApiProperty({ example: 'submission_item_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  submissionItemId!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      text: 'Company registration number uploaded.',
    },
  })
  @IsObject()
  value!: Record<string, unknown>;
}

export class AutosaveSubmissionAnswersDto {
  @ApiProperty({ type: () => AutosaveAnswerInputDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AutosaveAnswerInputDto)
  answers!: AutosaveAnswerInputDto[];
}
