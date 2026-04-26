import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/http/pagination.dto';
import {
  MANAGED_MEMBERSHIP_STATUS_VALUES,
  MANAGED_USER_STATUS_VALUES,
} from '../users.types';

export class ManagedUserMembershipDto {
  @ApiProperty({ example: 'membership_123' })
  membershipId!: string;

  @ApiProperty({ example: 'workspace_123' })
  workspaceId!: string;

  @ApiProperty({ example: 'Client Delivery' })
  workspaceName!: string;

  @ApiProperty({ example: 'ACME-ABCDEFG' })
  workspaceCode!: string;

  @ApiProperty({ example: 'role_123' })
  roleId!: string;

  @ApiProperty({ example: 'workspace_manager' })
  roleName!: string;

  @ApiProperty({
    enum: MANAGED_MEMBERSHIP_STATUS_VALUES,
    enumName: 'ManagedMembershipStatus',
    example: 'invited',
  })
  status!: (typeof MANAGED_MEMBERSHIP_STATUS_VALUES)[number];

  @ApiProperty({ example: '2026-04-23T10:00:00.000Z' })
  createdAt!: string;
}

export class ManagedUserDataDto {
  @ApiProperty({ example: 'user_123' })
  id!: string;

  @ApiProperty({ example: 'operator@acme.test' })
  email!: string;

  @ApiProperty({ example: '2026-04-23T10:00:00.000Z', nullable: true })
  emailVerifiedAt!: string | null;

  @ApiProperty({ example: 'Aylin Demir' })
  fullName!: string;

  @ApiProperty({ example: 'tr' })
  locale!: string;

  @ApiProperty({ example: '+905551112233', nullable: true })
  phone!: string | null;

  @ApiProperty({
    enum: MANAGED_USER_STATUS_VALUES,
    enumName: 'ManagedUserStatus',
    example: 'invited',
  })
  status!: (typeof MANAGED_USER_STATUS_VALUES)[number];

  @ApiProperty({ example: '2026-04-23T10:00:00.000Z', nullable: true })
  lastLoginAt!: string | null;

  @ApiProperty({ example: '2026-04-23T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: () => ManagedUserMembershipDto, isArray: true })
  memberships!: ManagedUserMembershipDto[];
}

export class UserResponseDto {
  @ApiProperty({ type: () => ManagedUserDataDto })
  data!: ManagedUserDataDto;
}

export class UserListResponseDto {
  @ApiProperty({ type: () => ManagedUserDataDto, isArray: true })
  data!: ManagedUserDataDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
