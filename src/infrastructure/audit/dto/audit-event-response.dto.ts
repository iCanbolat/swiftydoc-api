import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AUDIT_ACTIONS } from '../../../common/audit/audit-actions';
import { AUDIT_CHANNEL_VALUES } from '../../../common/audit/audit-channel';
import { RESOURCE_TYPE_VALUES } from '../../../common/audit/resource-types';
import { AUDIT_AUTH_SURFACE_VALUES } from '../audit.types';

const AUDIT_CATEGORY_VALUES = Object.keys(AUDIT_ACTIONS);
const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTIONS).flatMap((group) =>
  Object.values(group),
);

export class AuditActorSummaryDto {
  @ApiProperty({ example: 'usr_123' })
  id!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  fullName!: string;

  @ApiProperty({ example: 'ada@company.com' })
  email!: string;
}

export class AuditWorkspaceSummaryDto {
  @ApiProperty({ example: 'ws_123' })
  id!: string;

  @ApiProperty({ example: 'Operations' })
  name!: string;

  @ApiProperty({ example: 'ops' })
  code!: string;
}

export class AuditEventViewDto {
  @ApiProperty({ example: 'audit_evt_123' })
  id!: string;

  @ApiPropertyOptional({ example: 'org_123', nullable: true })
  organizationId!: string | null;

  @ApiProperty({
    enum: AUDIT_CATEGORY_VALUES,
    enumName: 'AuditCategory',
    example: 'security',
  })
  category!: string;

  @ApiPropertyOptional({
    enum: AUDIT_CHANNEL_VALUES,
    enumName: 'AuditChannel',
    example: 'api',
    nullable: true,
  })
  channel!: (typeof AUDIT_CHANNEL_VALUES)[number] | null;

  @ApiProperty({
    enum: AUDIT_ACTION_VALUES,
    enumName: 'AuditAction',
    example: 'security.internal_auth_session_started',
  })
  action!: string;

  @ApiProperty({
    enum: AUDIT_AUTH_SURFACE_VALUES,
    enumName: 'AuditAuthSurface',
    example: 'internal',
  })
  authSurface!: (typeof AUDIT_AUTH_SURFACE_VALUES)[number];

  @ApiPropertyOptional({ example: 'user', nullable: true })
  actorType!: string | null;

  @ApiPropertyOptional({ example: 'usr_123', nullable: true })
  actorId!: string | null;

  @ApiPropertyOptional({ type: () => AuditActorSummaryDto, nullable: true })
  actor!: AuditActorSummaryDto | null;

  @ApiPropertyOptional({ example: 'sess_123', nullable: true })
  sessionId!: string | null;

  @ApiPropertyOptional({ example: 'ws_123', nullable: true })
  activeWorkspaceId!: string | null;

  @ApiPropertyOptional({
    type: () => AuditWorkspaceSummaryDto,
    nullable: true,
  })
  activeWorkspace!: AuditWorkspaceSummaryDto | null;

  @ApiPropertyOptional({ example: 'usr_support_123', nullable: true })
  impersonatorActorId!: string | null;

  @ApiPropertyOptional({ example: 'sess_support_123', nullable: true })
  impersonatorSessionId!: string | null;

  @ApiPropertyOptional({ type: () => AuditActorSummaryDto, nullable: true })
  impersonator!: AuditActorSummaryDto | null;

  @ApiPropertyOptional({
    enum: RESOURCE_TYPE_VALUES,
    enumName: 'ResourceType',
    example: 'workspace',
    nullable: true,
  })
  resourceType!: (typeof RESOURCE_TYPE_VALUES)[number] | null;

  @ApiPropertyOptional({ example: 'resource_123', nullable: true })
  resourceId!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      ipAddress: '203.0.113.10',
      userAgent: 'Mozilla/5.0',
    },
  })
  metadata!: Record<string, unknown>;

  @ApiProperty({ example: '2026-04-24T10:00:00.000Z' })
  createdAt!: string;
}

export class AuditEventListResponseDto {
  @ApiProperty({ type: () => AuditEventViewDto, isArray: true })
  data!: AuditEventViewDto[];
}