import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditCategory,
} from '../../../common/audit/audit-actions';
import {
  AUDIT_CHANNEL_VALUES,
  type AuditChannel,
} from '../../../common/audit/audit-channel';
import {
  RESOURCE_TYPE_VALUES,
  type ResourceType,
} from '../../../common/audit/resource-types';
import {
  AUDIT_AUTH_SURFACE_VALUES,
  type AuditAuthSurface,
} from '../audit.types';

const AUDIT_CATEGORY_VALUES = Object.keys(AUDIT_ACTIONS) as AuditCategory[];
const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTIONS).flatMap((group) =>
  Object.values(group),
) as AuditAction[];

export class ListAuditEventsQueryDto {
  @ApiPropertyOptional({
    enum: AUDIT_CATEGORY_VALUES,
    enumName: 'AuditCategory',
    example: 'security',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(AUDIT_CATEGORY_VALUES)
  category?: AuditCategory;

  @ApiPropertyOptional({
    enum: AUDIT_ACTION_VALUES,
    enumName: 'AuditAction',
    example: 'security.internal_auth_session_started',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(AUDIT_ACTION_VALUES)
  action?: AuditAction;

  @ApiPropertyOptional({
    enum: AUDIT_CHANNEL_VALUES,
    enumName: 'AuditChannel',
    example: 'api',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(AUDIT_CHANNEL_VALUES)
  channel?: AuditChannel;

  @ApiPropertyOptional({
    enum: AUDIT_AUTH_SURFACE_VALUES,
    enumName: 'AuditAuthSurface',
    example: 'internal',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(AUDIT_AUTH_SURFACE_VALUES)
  authSurface?: AuditAuthSurface;

  @ApiPropertyOptional({ example: 'usr_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  actorId?: string;

  @ApiPropertyOptional({ example: 'sess_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  sessionId?: string;

  @ApiPropertyOptional({ example: 'ws_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  workspaceId?: string;

  @ApiPropertyOptional({ example: 'usr_support_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  impersonatorActorId?: string;

  @ApiPropertyOptional({ example: 'sess_support_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  impersonatorSessionId?: string;

  @ApiPropertyOptional({
    enum: RESOURCE_TYPE_VALUES,
    enumName: 'ResourceType',
    example: 'workspace',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(RESOURCE_TYPE_VALUES)
  resourceType?: ResourceType;

  @ApiPropertyOptional({ example: 'resource_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  resourceId?: string;

  @ApiPropertyOptional({
    example: '2026-04-24T10:00:00.000Z',
    description: 'Return events created before this timestamp.',
  })
  @IsOptional()
  @IsDateString()
  beforeCreatedAt?: string;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}