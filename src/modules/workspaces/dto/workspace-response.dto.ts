import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/http/pagination.dto';
import { WORKSPACE_STATUS_VALUES } from '../workspaces.types';

export class WorkspaceDataDto {
  @ApiProperty({ example: 'workspace_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiProperty({ example: 'Client Delivery' })
  name!: string;

  @ApiProperty({ example: 'ACME-ABCDEFG' })
  code!: string;

  @ApiProperty({
    enum: WORKSPACE_STATUS_VALUES,
    enumName: 'WorkspaceStatus',
    example: 'active',
  })
  status!: (typeof WORKSPACE_STATUS_VALUES)[number];

  @ApiProperty({ example: '2026-04-23T10:00:00.000Z' })
  createdAt!: string;
}

export class WorkspaceResponseDto {
  @ApiProperty({ type: () => WorkspaceDataDto })
  data!: WorkspaceDataDto;
}

export class WorkspaceListResponseDto {
  @ApiProperty({ type: () => WorkspaceDataDto, isArray: true })
  data!: WorkspaceDataDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
