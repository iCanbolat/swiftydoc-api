import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ForgotPasswordDto {
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
}
