import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  PORTAL_LINK_PURPOSE_VALUES,
  type PortalLinkPurpose,
} from '../../../common/portal/portal-link-types';

export class VerifyPortalLinkDto {
  @ApiProperty({ example: 'req_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  requestId!: string;

  @ApiProperty({
    example: '49b977787e6a203ceb5cfd0f4a5222f049ef92d782f61115095c5d57f453ff70',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;

  @ApiPropertyOptional({
    enum: PORTAL_LINK_PURPOSE_VALUES,
    enumName: 'PortalLinkPurpose',
    example: 'request_access',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(PORTAL_LINK_PURPOSE_VALUES)
  purpose?: PortalLinkPurpose;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  consume?: boolean;
}
