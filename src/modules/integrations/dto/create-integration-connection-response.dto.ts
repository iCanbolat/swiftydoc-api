import { ApiProperty } from '@nestjs/swagger';
import { IntegrationConnectionDataDto } from './integration-connection-response.dto';

export class CreateIntegrationConnectionResponseDto {
  @ApiProperty({ type: () => IntegrationConnectionDataDto })
  data!: IntegrationConnectionDataDto;
}