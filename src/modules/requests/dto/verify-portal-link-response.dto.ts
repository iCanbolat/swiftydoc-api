import { ApiProperty } from '@nestjs/swagger';
import {
  PORTAL_LINK_PURPOSE_VALUES,
  PORTAL_LINK_STATUS_VALUES,
} from '../../../common/portal/portal-link-types';

export class VerifyPortalLinkResponseDataDto {
  @ApiProperty({ example: 'pl_123' })
  portalLinkId!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

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
    example: 'consumed',
  })
  status!: (typeof PORTAL_LINK_STATUS_VALUES)[number];

  @ApiProperty({ example: true })
  consumed!: boolean;

  @ApiProperty({ example: 0 })
  remainingUses!: number;

  @ApiProperty({ example: '2026-04-28T11:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: 'Portal', nullable: true })
  tokenType!: string | null;

  @ApiProperty({ example: 'swd_pt_payload.signature', nullable: true })
  portalAccessToken!: string | null;

  @ApiProperty({ example: '2026-04-28T11:30:00.000Z', nullable: true })
  accessTokenExpiresAt!: string | null;
}

export class VerifyPortalLinkResponseDto {
  @ApiProperty({ type: () => VerifyPortalLinkResponseDataDto })
  data!: VerifyPortalLinkResponseDataDto;
}
