import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { StorageDriver } from '../../../infrastructure/storage/storage.types';

export class UploadFileResponseDataDto {
  @ApiProperty({ example: 'org_123/2026-04-21/uuid_passport.pdf' })
  storageKey!: string;

  @ApiProperty({ example: 'application/pdf' })
  contentType!: string;

  @ApiProperty({ example: 245760 })
  sizeBytes!: number;

  @ApiPropertyOptional({
    example: 'https://pullzone.example.com/org_123/2026-04-21/file.pdf',
    nullable: true,
  })
  publicUrl!: string | null;

  @ApiProperty({ enum: ['local', 'bunny'], example: 'local' })
  storageDriver!: StorageDriver;

  @ApiProperty({
    example:
      'http://localhost:3000/v1/files/download?key=org_123%2F2026-04-21%2Fuuid_passport.pdf',
  })
  downloadUrl!: string;
}

export class UploadFileResponseDto {
  @ApiProperty({ type: () => UploadFileResponseDataDto })
  data!: UploadFileResponseDataDto;
}
