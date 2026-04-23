import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CLIENT_STATUS_VALUES } from '../clients.types';

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
}

export class ClientResponseDto {
  @ApiProperty({ type: () => ClientDataDto })
  data!: ClientDataDto;
}

export class ClientListResponseDto {
  @ApiProperty({ type: () => ClientDataDto, isArray: true })
  data!: ClientDataDto[];
}
