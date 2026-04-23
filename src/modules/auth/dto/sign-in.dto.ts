import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SignInDto {
  @ApiProperty({ example: 'acme-advisory' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(slugPattern)
  organizationSlug!: string;

  @ApiProperty({ example: 'owner@acme.test' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'SwiftyDoc2025!' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
