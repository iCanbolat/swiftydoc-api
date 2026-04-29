import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/http/pagination.dto';
import { RequestDataDto } from '../../requests/dto/request-response.dto';
import { CLIENT_STATUS_VALUES } from '../clients.types';

export class ClientRequestCountsDto {
  @ApiProperty({ example: 1 })
  draft!: number;

  @ApiProperty({ example: 2 })
  sent!: number;

  @ApiProperty({ example: 3 })
  inProgress!: number;

  @ApiProperty({ example: 4 })
  completed!: number;

  @ApiProperty({ example: 1 })
  closed!: number;

  @ApiProperty({ example: 0 })
  cancelled!: number;

  @ApiProperty({ example: 11 })
  total!: number;
}

export class ClientSummaryDto {
  @ApiProperty({ type: () => ClientRequestCountsDto })
  requestCounts!: ClientRequestCountsDto;

  @ApiProperty({ example: 6 })
  openRequestCount!: number;

  @ApiProperty({ example: 2 })
  overdueRequestCount!: number;

  @ApiPropertyOptional({
    example: '2026-04-28T08:12:00.000Z',
    nullable: true,
  })
  lastRequestActivityAt!: string | null;

  @ApiPropertyOptional({
    example: '2026-05-02T09:00:00.000Z',
    nullable: true,
  })
  nextDueAt!: string | null;
}

export class ClientPrimaryContactDto {
  @ApiProperty({ example: 'contact_123' })
  id!: string;

  @ApiProperty({ example: 'Mina Yilmaz' })
  fullName!: string;

  @ApiProperty({ example: 'mina@atlasfreight.co' })
  email!: string;

  @ApiPropertyOptional({ example: '+90 555 555 55 55', nullable: true })
  phone!: string | null;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty({ example: '2026-04-21T09:15:00.000Z' })
  createdAt!: string;
}

export class ClientRecentRecipientDto {
  @ApiProperty({ example: 'recipient_123' })
  id!: string;

  @ApiProperty({ example: 'Finance contact' })
  label!: string;

  @ApiProperty({ example: 'finance@atlasfreight.co' })
  email!: string;

  @ApiProperty({ example: 'email' })
  deliveryChannel!: string;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty({ example: '2026-04-22T09:15:00.000Z' })
  createdAt!: string;
}

export class ClientContactsPreviewDto {
  @ApiPropertyOptional({ type: () => ClientPrimaryContactDto, nullable: true })
  primaryContact!: ClientPrimaryContactDto | null;

  @ApiProperty({ type: () => ClientRecentRecipientDto, isArray: true })
  recentRecipients!: ClientRecentRecipientDto[];

  @ApiProperty({ example: 3 })
  totalContacts!: number;
}

export class ClientDataDto {
  @ApiProperty({ example: 'client_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiProperty({ example: 'ws_123' })
  workspaceId!: string;

  @ApiProperty({ example: 'Acme Advisory LLC' })
  displayName!: string;

  @ApiPropertyOptional({ example: 'Acme Advisory Limited', nullable: true })
  legalName!: string | null;

  @ApiPropertyOptional({ example: 'ext_acme_001', nullable: true })
  externalRef!: string | null;

  @ApiPropertyOptional({ example: 'Istanbul', nullable: true })
  province!: string | null;

  @ApiPropertyOptional({ example: 'Besiktas', nullable: true })
  district!: string | null;

  @ApiProperty({
    enum: CLIENT_STATUS_VALUES,
    enumName: 'ClientStatus',
    example: 'active',
  })
  status!: (typeof CLIENT_STATUS_VALUES)[number];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      segment: 'kyc',
    },
  })
  metadata!: Record<string, unknown>;

  @ApiProperty({ example: '2026-04-23T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-23T10:00:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  archivedAt!: string | null;

  @ApiPropertyOptional({ type: () => ClientSummaryDto, nullable: true })
  summary?: ClientSummaryDto;

  @ApiPropertyOptional({ type: () => ClientContactsPreviewDto, nullable: true })
  contactsPreview?: ClientContactsPreviewDto;

  @ApiPropertyOptional({ type: () => RequestDataDto, isArray: true })
  requestHistory?: RequestDataDto[];
}

export class ClientResponseDto {
  @ApiProperty({ type: () => ClientDataDto })
  data!: ClientDataDto;
}

export class ClientListResponseDto {
  @ApiProperty({ type: () => ClientDataDto, isArray: true })
  data!: ClientDataDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
