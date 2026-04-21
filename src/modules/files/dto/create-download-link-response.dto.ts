import { ApiProperty } from '@nestjs/swagger';

export class CreateDownloadLinkResponseDataDto {
  @ApiProperty({ example: 'org_123/2026-04-21/uuid_passport.pdf' })
  storageKey!: string;

  @ApiProperty({
    example:
      'http://localhost:3000/v1/files/download?key=org_123%2F2026-04-21%2Fuuid_passport.pdf',
  })
  url!: string;
}

export class CreateDownloadLinkResponseDto {
  @ApiProperty({ type: () => CreateDownloadLinkResponseDataDto })
  data!: CreateDownloadLinkResponseDataDto;
}
