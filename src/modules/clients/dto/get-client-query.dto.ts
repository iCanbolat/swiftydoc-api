import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetClientQueryDto {
  @ApiPropertyOptional({
    example: 'summary,contactsPreview,requestHistory',
  })
  @IsOptional()
  @IsString()
  include?: string;
}
