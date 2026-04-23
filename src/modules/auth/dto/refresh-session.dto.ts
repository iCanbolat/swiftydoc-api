import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshSessionDto {
  @ApiProperty({ example: 'swd_rt_0123456789abcdef0123456789abcdef' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  refreshToken!: string;
}
