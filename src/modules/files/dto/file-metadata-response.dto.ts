import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { StorageDriver } from '../../../infrastructure/storage/storage.types';

export class FileMetadataResponseDataDto {
  @ApiProperty({ example: 'file_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiPropertyOptional({ example: 'req_123', nullable: true })
  requestId!: string | null;

  @ApiPropertyOptional({ example: 'submission_123', nullable: true })
  submissionId!: string | null;

  @ApiPropertyOptional({ example: 'submission_item_123', nullable: true })
  submissionItemId!: string | null;

  @ApiProperty({ example: 'passport.pdf' })
  originalFileName!: string;

  @ApiProperty({ example: 'passport.pdf' })
  normalizedFileName!: string;

  @ApiPropertyOptional({ example: 'pdf', nullable: true })
  extension!: string | null;

  @ApiPropertyOptional({ example: 'application/pdf', nullable: true })
  declaredMimeType!: string | null;

  @ApiProperty({ example: 'application/pdf' })
  detectedMimeType!: string;

  @ApiProperty({ example: 245760 })
  sizeBytes!: number;

  @ApiProperty({
    example: 'a6f9d0f28d4e34fbc2e4692f17b6c2c950b6d9d854a7e589dbf5fca2ab32be7d',
  })
  checksumSha256!: string;

  @ApiProperty({ example: 'org_123/2026-04-21/uuid_passport.pdf' })
  storageKey!: string;

  @ApiProperty({ enum: ['local', 'bunny'], example: 'local' })
  storageDriver!: StorageDriver;

  @ApiPropertyOptional({
    example: 'https://pullzone.example.com/org_123/2026-04-21/file.pdf',
    nullable: true,
  })
  publicUrl!: string | null;

  @ApiProperty({
    example:
      'http://localhost:3000/v1/files/download?key=org_123%2F2026-04-21%2Fuuid_passport.pdf',
  })
  downloadUrl!: string;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty({ example: '2026-04-21T12:00:00.000Z' })
  createdAt!: string;
}

export class FileMetadataResponseDto {
  @ApiProperty({ type: () => FileMetadataResponseDataDto })
  data!: FileMetadataResponseDataDto;
}
