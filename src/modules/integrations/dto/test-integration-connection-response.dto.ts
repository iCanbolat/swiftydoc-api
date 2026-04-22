import { ApiProperty } from '@nestjs/swagger';
import { IntegrationConnectionDataDto } from './integration-connection-response.dto';

export class TestedIntegrationConnectionResultDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'connected' })
  status!: 'connected' | 'degraded';

  @ApiProperty({ example: 'live' })
  mode!: 'live' | 'simulated';

  @ApiProperty({ example: 'WhatsApp Cloud API connection test succeeded.' })
  message!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      displayPhoneNumber: '+971500000000',
      verifiedName: 'SwiftyDoc',
    },
  })
  metadata!: Record<string, unknown>;
}

export class TestIntegrationConnectionResponseDataDto {
  @ApiProperty({ type: () => IntegrationConnectionDataDto })
  connection!: IntegrationConnectionDataDto;

  @ApiProperty({ type: () => TestedIntegrationConnectionResultDto })
  result!: TestedIntegrationConnectionResultDto;
}

export class TestIntegrationConnectionResponseDto {
  @ApiProperty({ type: () => TestIntegrationConnectionResponseDataDto })
  data!: TestIntegrationConnectionResponseDataDto;
}