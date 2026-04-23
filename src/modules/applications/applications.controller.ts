import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentActor } from '../auth/current-actor.decorator';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { OrganizationOwnerGuard } from '../auth/organization-owner.guard';
import type { AuthenticatedInternalActor } from '../auth/auth.types';
import { ApplicationsService } from './applications.service';
import { CreateOAuthApplicationDto } from './dto/create-oauth-application.dto';
import { OAuthApplicationCredentialResponseDto } from './dto/oauth-application-credential-response.dto';
import {
  OAuthApplicationListResponseDto,
  OAuthApplicationResponseDto,
} from './dto/oauth-application-response.dto';
import { RotateOAuthApplicationSecretDto } from './dto/rotate-oauth-application-secret.dto';
import { UpdateOAuthApplicationDto } from './dto/update-oauth-application.dto';

@ApiTags('Applications')
@ApiBearerAuth('bearer')
@UseGuards(InternalAuthGuard)
@Controller('v1/applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @ApiOperation({
    summary: 'List registered OAuth applications for an organization.',
  })
  @ApiOkResponse({ type: OAuthApplicationListResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @Get()
  async listApplications(@CurrentActor() actor: AuthenticatedInternalActor) {
    const applications = await this.applicationsService.listApplications(
      actor.organization.id,
    );

    return {
      data: applications.map((application) =>
        this.applicationsService.sanitizeApplication(application),
      ),
    };
  }

  @ApiOperation({
    summary: 'Create a self-serve OAuth application registration.',
  })
  @ApiCreatedResponse({ type: OAuthApplicationCredentialResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Only organization owners can manage OAuth applications.',
  })
  @UseGuards(OrganizationOwnerGuard)
  @Post()
  async createApplication(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: CreateOAuthApplicationDto,
  ) {
    const result = await this.applicationsService.createApplication({
      organizationId: actor.organization.id,
      actorUserId: actor.user.id,
      name: body.name,
      description: body.description,
      redirectUris: body.redirectUris,
      allowedScopes: body.allowedScopes,
      applicationType: body.applicationType,
    });

    return {
      data: {
        application: this.applicationsService.sanitizeApplication(
          result.application,
        ),
        clientSecret: result.clientSecret,
      },
    };
  }

  @ApiOperation({ summary: 'Get OAuth application details.' })
  @ApiOkResponse({ type: OAuthApplicationResponseDto })
  @ApiNotFoundResponse({ description: 'OAuth application not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @Get(':id')
  async getApplication(
    @Param('id') applicationId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    const application = await this.applicationsService.getApplication(
      applicationId,
      actor.organization.id,
    );

    return {
      data: this.applicationsService.sanitizeApplication(application),
    };
  }

  @ApiOperation({
    summary: 'Update OAuth application metadata, scopes, and status.',
  })
  @ApiOkResponse({ type: OAuthApplicationResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'OAuth application not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Only organization owners can manage OAuth applications.',
  })
  @UseGuards(OrganizationOwnerGuard)
  @Patch(':id')
  async updateApplication(
    @Param('id') applicationId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: UpdateOAuthApplicationDto,
  ) {
    const application = await this.applicationsService.updateApplication(
      applicationId,
      {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        name: body.name,
        description: body.description,
        redirectUris: body.redirectUris,
        allowedScopes: body.allowedScopes,
        applicationType: body.applicationType,
        status: body.status,
      },
    );

    return {
      data: this.applicationsService.sanitizeApplication(application),
    };
  }

  @ApiOperation({
    summary: 'Rotate the client secret for a confidential OAuth application.',
  })
  @ApiOkResponse({ type: OAuthApplicationCredentialResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'OAuth application not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Only organization owners can manage OAuth applications.',
  })
  @UseGuards(OrganizationOwnerGuard)
  @Post(':id/rotate-secret')
  async rotateApplicationSecret(
    @Param('id') applicationId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: RotateOAuthApplicationSecretDto,
  ) {
    const result = await this.applicationsService.rotateApplicationSecret(
      applicationId,
      {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
      },
    );

    return {
      data: {
        application: this.applicationsService.sanitizeApplication(
          result.application,
        ),
        clientSecret: result.clientSecret,
      },
    };
  }
}
