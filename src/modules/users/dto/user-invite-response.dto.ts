import { ApiProperty } from '@nestjs/swagger';

export class UserInviteDispatchDataDto {
  @ApiProperty({ example: true })
  emailDispatched!: boolean;

  @ApiProperty({ example: '2026-04-26T10:00:00.000Z' })
  expiresAt!: string;
}

export class UserInviteDispatchResponseDto {
  @ApiProperty({ type: () => UserInviteDispatchDataDto })
  data!: UserInviteDispatchDataDto;
}

export class UserInviteRevocationDataDto {
  @ApiProperty({ example: true })
  revoked!: boolean;

  @ApiProperty({ example: 1 })
  revokedTokenCount!: number;
}

export class UserInviteRevocationResponseDto {
  @ApiProperty({ type: () => UserInviteRevocationDataDto })
  data!: UserInviteRevocationDataDto;
}
