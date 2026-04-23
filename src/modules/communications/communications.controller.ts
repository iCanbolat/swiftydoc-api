import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { RemindersService } from '../../infrastructure/reminders/reminders.service';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedInternalActor } from '../auth/auth.types';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { OrganizationPermissions } from '../auth/organization-policy.decorator';
import { OrganizationPolicyGuard } from '../auth/organization-policy.guard';
import { UpsertBrandingSettingsDto } from './dto/upsert-branding-settings.dto';
import { UpsertBrandingSettingsResponseDto } from './dto/upsert-branding-settings-response.dto';
import { UpsertEmailTemplateVariantDto } from './dto/upsert-email-template-variant.dto';
import { UpsertEmailTemplateVariantResponseDto } from './dto/upsert-email-template-variant-response.dto';
import { UpsertReminderProviderConfigDto } from './dto/upsert-reminder-provider-config.dto';
import { UpsertReminderProviderConfigResponseDto } from './dto/upsert-reminder-provider-config-response.dto';

@ApiTags('Communications')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({
  description: 'User does not have organization-level access to this resource.',
})
@UseGuards(InternalAuthGuard, OrganizationPolicyGuard)
@Controller('v1/communications')
export class CommunicationsController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly remindersService: RemindersService,
  ) {}

  @ApiOperation({
    summary: 'Upsert reminder provider config for an org channel.',
  })
  @ApiCreatedResponse({ type: UpsertReminderProviderConfigResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('organization.settings.write')
  @Put('provider-configs')
  async upsertProviderConfig(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: UpsertReminderProviderConfigDto,
  ) {
    const config = await this.remindersService.upsertProviderConfig({
      organizationId: actor.organization.id,
      channel: body.channel,
      provider: body.provider,
      enabled: body.enabled,
      config: body.config,
    });

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'api',
      action: AUDIT_ACTIONS.data_access.reminderProviderConfigured,
      organizationId: actor.organization.id,
      actorId: actor.user.id,
      actorType: 'user',
      resourceType: RESOURCE_TYPES.automation.reminderProviderConfig,
      resourceId: config.id,
      metadata: {
        channel: config.channel,
        provider: config.provider,
        enabled: config.enabled,
      },
    });

    return {
      data: {
        id: config.id,
        organizationId: config.organizationId,
        channel: config.channel,
        provider: config.provider,
        enabled: config.enabled,
        updatedAt: config.updatedAt.toISOString(),
      },
    };
  }

  @ApiOperation({ summary: 'Upsert organization-level branding settings.' })
  @ApiCreatedResponse({ type: UpsertBrandingSettingsResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('organization.settings.write')
  @Put('branding')
  async upsertBranding(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: UpsertBrandingSettingsDto,
  ) {
    const branding = await this.remindersService.upsertBrandingSettings({
      organizationId: actor.organization.id,
      displayName: body.displayName,
      logoUrl: body.logoUrl,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      emailFromName: body.emailFromName,
      emailReplyTo: body.emailReplyTo,
      metadata: body.metadata,
    });

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'api',
      action: AUDIT_ACTIONS.data_access.brandingSettingsUpdated,
      organizationId: actor.organization.id,
      actorId: actor.user.id,
      actorType: 'user',
      resourceType: RESOURCE_TYPES.identity.brandingSettings,
      resourceId: branding.id,
      metadata: {
        displayName: branding.displayName,
      },
    });

    return {
      data: {
        id: branding.id,
        organizationId: branding.organizationId,
        displayName: branding.displayName,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        emailFromName: branding.emailFromName,
        emailReplyTo: branding.emailReplyTo,
        updatedAt: branding.updatedAt.toISOString(),
      },
    };
  }

  @ApiOperation({
    summary: 'Upsert Resend email template variant for reminder flow.',
  })
  @ApiCreatedResponse({ type: UpsertEmailTemplateVariantResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('organization.settings.write')
  @Put('email-template-variants')
  async upsertEmailTemplateVariant(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: UpsertEmailTemplateVariantDto,
  ) {
    const templateVariant =
      await this.remindersService.upsertEmailTemplateVariant({
        organizationId: actor.organization.id,
        templateKey: body.templateKey,
        locale: body.locale,
        resendTemplateId: body.resendTemplateId,
        subjectTemplate: body.subjectTemplate,
        bodyTemplate: body.bodyTemplate,
        metadata: body.metadata,
      });

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'api',
      action: AUDIT_ACTIONS.data_access.emailTemplateVariantUpserted,
      organizationId: actor.organization.id,
      actorId: actor.user.id,
      actorType: 'user',
      resourceType: RESOURCE_TYPES.identity.emailTemplateVariant,
      resourceId: templateVariant.id,
      metadata: {
        templateKey: templateVariant.templateKey,
        locale: templateVariant.locale,
        provider: templateVariant.provider,
      },
    });

    return {
      data: {
        id: templateVariant.id,
        organizationId: templateVariant.organizationId,
        templateKey: templateVariant.templateKey,
        locale: templateVariant.locale,
        provider: templateVariant.provider,
        resendTemplateId: templateVariant.resendTemplateId,
        subjectTemplate: templateVariant.subjectTemplate,
        bodyTemplate: templateVariant.bodyTemplate,
        updatedAt: templateVariant.updatedAt.toISOString(),
      },
    };
  }
}
