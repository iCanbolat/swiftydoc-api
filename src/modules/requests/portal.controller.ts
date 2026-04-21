import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { VerifyPortalLinkDto } from './dto/verify-portal-link.dto';
import { VerifyPortalLinkResponseDto } from './dto/verify-portal-link-response.dto';
import { RequestWorkflowService } from './request-workflow.service';

@ApiTags('Portal')
@Controller('v1/portal')
export class PortalController {
  constructor(
    private readonly requestWorkflowService: RequestWorkflowService,
  ) {}

  @ApiOperation({
    summary: 'Verify and optionally consume a secure portal link.',
  })
  @ApiCreatedResponse({ type: VerifyPortalLinkResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Portal link is invalid or expired.',
  })
  @Post('access')
  async verifyAccess(@Body() body: VerifyPortalLinkDto) {
    const portalAccess = await this.requestWorkflowService.verifyPortalLink({
      requestId: body.requestId,
      token: body.token,
      purpose: body.purpose,
      consume: body.consume,
    });

    return {
      data: portalAccess,
    };
  }
}
