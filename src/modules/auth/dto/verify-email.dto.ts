import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'swd_ev_0123456789abcdef0123456789abcdef' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;
}
