import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CompleteInviteDto {
  @ApiProperty({ example: 'swd_inv_0123456789abcdef0123456789abcdef' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;

  @ApiProperty({ example: 'SwiftyDoc2025!' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
