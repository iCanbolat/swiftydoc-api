import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ListClientsQueryDto {
  @ApiProperty({ example: 'ws_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  workspaceId!: string;
}
