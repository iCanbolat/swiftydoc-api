import { ApiProperty } from '@nestjs/swagger';
import {
  PORTAL_LINK_PURPOSE_VALUES,
  PORTAL_LINK_STATUS_VALUES,
} from '../../../common/portal/portal-link-types';

export class CreatePortalLinkResponseDataDto {
  @ApiProperty({ example: 'pl_123' })
  id!: string;

  @ApiProperty({ example: 'req_123' })
  requestId!: string;

  @ApiProperty({ nullable: true, example: 'submission_123' })
  submissionId!: string | null;

  @ApiProperty({ nullable: true, example: 'recipient_123' })
  recipientId!: string | null;

  @ApiProperty({
    enum: PORTAL_LINK_PURPOSE_VALUES,
    enumName: 'PortalLinkPurpose',
    example: 'request_access',
  })
  purpose!: (typeof PORTAL_LINK_PURPOSE_VALUES)[number];

  @ApiProperty({
    enum: PORTAL_LINK_STATUS_VALUES,
    enumName: 'PortalLinkStatus',
    example: 'active',
  })
  status!: (typeof PORTAL_LINK_STATUS_VALUES)[number];

  @ApiProperty({ example: '2026-04-28T11:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: 1 })
  maxUses!: number;

  @ApiProperty({ example: 0 })
  usedCount!: number;

  @ApiProperty({
    example: '49b977787e6a203ceb5cfd0f4a5222f049ef92d782f61115095c5d57f453ff70',
  })
  token!: string;

  @ApiProperty({
    example:
      'http://localhost:3000/v1/portal/access?requestId=req_123&token=49b977787e6a203c...',
  })
  accessUrl!: string;
}

export class CreatePortalLinkResponseDto {
  @ApiProperty({ type: () => CreatePortalLinkResponseDataDto })
  data!: CreatePortalLinkResponseDataDto;
}
