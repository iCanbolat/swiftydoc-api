import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/http/pagination.dto';
import { REQUEST_STATUS_VALUES } from '../../../common/requests/request-workflow';

export class RequestOwnerUserDto {
  @ApiProperty({ example: 'user_123' })
  id!: string;

  @ApiProperty({ example: 'Mina Yilmaz' })
  fullName!: string;

  @ApiProperty({ example: 'mina@swiftydoc.test' })
  email!: string;
}

export class RequestDataDto {
  @ApiProperty({ example: 'req_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiProperty({ example: 'ws_123' })
  workspaceId!: string;

  @ApiProperty({ example: 'client_123' })
  clientId!: string;

  @ApiProperty({ example: 'tpl_123' })
  templateId!: string;

  @ApiProperty({ example: 'tpl_ver_001' })
  templateVersionId!: string;

  @ApiProperty({ example: 'REQ-MGUEI3-R9A31F82' })
  requestCode!: string;

  @ApiProperty({ example: 'KYC onboarding - ACME Ltd' })
  title!: string;

  @ApiPropertyOptional({
    example: 'Please upload the latest incorporation pack.',
    nullable: true,
  })
  message!: string | null;

  @ApiProperty({
    enum: REQUEST_STATUS_VALUES,
    enumName: 'RequestStatus',
    example: 'draft',
  })
  status!: (typeof REQUEST_STATUS_VALUES)[number];

  @ApiPropertyOptional({ example: '2026-05-05T09:30:00.000Z', nullable: true })
  dueAt!: string | null;

  @ApiPropertyOptional({ example: '2026-04-21T11:15:00.000Z', nullable: true })
  sentAt!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  closedAt!: string | null;

  @ApiProperty({ example: 'Vendor onboarding' })
  templateName!: string;

  @ApiProperty({ example: 3 })
  recipientCount!: number;

  @ApiProperty({ example: 9 })
  completedItems!: number;

  @ApiProperty({ example: 12 })
  totalItems!: number;

  @ApiPropertyOptional({ type: () => RequestOwnerUserDto, nullable: true })
  ownerUser!: RequestOwnerUserDto | null;

  @ApiProperty({ example: '2026-04-21T09:15:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-21T11:15:00.000Z' })
  updatedAt!: string;
}

export class RequestResponseDto {
  @ApiProperty({ type: () => RequestDataDto })
  data!: RequestDataDto;
}

export class RequestListResponseDto {
  @ApiProperty({ type: () => RequestDataDto, isArray: true })
  data!: RequestDataDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
