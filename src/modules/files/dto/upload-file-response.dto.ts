import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { StorageDriver } from '../../../infrastructure/storage/storage.types';

export class UploadFileResponseDataDto {
  @ApiProperty({ example: 'file_123' })
  fileId!: string;

  @ApiProperty({ example: 'passport.pdf' })
  originalFileName!: string;

  @ApiProperty({ example: 'passport.pdf' })
  normalizedFileName!: string;

  @ApiProperty({ example: 'org_123/2026-04-21/uuid_passport.pdf' })
  storageKey!: string;

  @ApiPropertyOptional({ example: 'application/pdf', nullable: true })
  declaredMimeType!: string | null;

  @ApiProperty({ example: 'application/pdf' })
  detectedMimeType!: string;

  @ApiProperty({
    example: 'a6f9d0f28d4e34fbc2e4692f17b6c2c950b6d9d854a7e589dbf5fca2ab32be7d',
  })
  checksumSha256!: string;

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
