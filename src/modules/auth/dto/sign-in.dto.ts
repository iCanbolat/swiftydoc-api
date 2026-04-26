import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SignInDto {
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
