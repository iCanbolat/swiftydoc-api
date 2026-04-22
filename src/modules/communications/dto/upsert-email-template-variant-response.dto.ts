import { ApiProperty } from '@nestjs/swagger';

export class UpsertEmailTemplateVariantResponseDataDto {
  @ApiProperty({ example: 'email_tpl_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiProperty({ example: 'request_reminder' })
  templateKey!: string;

  @ApiProperty({ example: 'en' })
  locale!: string;

  @ApiProperty({ example: 'resend' })
  provider!: string;

  @ApiProperty({ nullable: true, example: 'tpl_123456' })
  resendTemplateId!: string | null;

  @ApiProperty({ example: 'Reminder: {{requestCode}} is waiting' })
  subjectTemplate!: string;

  @ApiProperty({
    example:
      'Hi {{clientName}}, please complete request {{requestCode}} using your secure link.',
  })
  bodyTemplate!: string;

  @ApiProperty({ example: '2026-04-22T10:30:00.000Z' })
  updatedAt!: string;
}

export class UpsertEmailTemplateVariantResponseDto {
  @ApiProperty({ type: () => UpsertEmailTemplateVariantResponseDataDto })
  data!: UpsertEmailTemplateVariantResponseDataDto;
}
