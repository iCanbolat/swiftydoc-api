import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DownloadFileQueryDto {
  @ApiProperty({ example: 'org_123/2026-04-21/uuid_passport.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  key!: string;
}
