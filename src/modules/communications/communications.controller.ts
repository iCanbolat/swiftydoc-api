import { Body, Controller, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { RemindersService } from '../../infrastructure/reminders/reminders.service';
import { UpsertBrandingSettingsDto } from './dto/upsert-branding-settings.dto';
import { UpsertBrandingSettingsResponseDto } from './dto/upsert-branding-settings-response.dto';
import { UpsertEmailTemplateVariantDto } from './dto/upsert-email-template-variant.dto';
import { UpsertEmailTemplateVariantResponseDto } from './dto/upsert-email-template-variant-response.dto';
import { UpsertReminderProviderConfigDto } from './dto/upsert-reminder-provider-config.dto';
import { UpsertReminderProviderConfigResponseDto } from './dto/upsert-reminder-provider-config-response.dto';

@ApiTags('Communications')
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
  @Put('provider-configs')
  async upsertProviderConfig(@Body() body: UpsertReminderProviderConfigDto) {
    const config = await this.remindersService.upsertProviderConfig({
      organizationId: body.organizationId,
      channel: body.channel,
      provider: body.provider,
      enabled: body.enabled,
      config: body.config,
    });

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'api',
      action: AUDIT_ACTIONS.data_access.reminderProviderConfigured,
      organizationId: body.organizationId,
      actorId: body.actorUserId,
      actorType: body.actorUserId ? 'user' : undefined,
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
  @Put('branding')
  async upsertBranding(@Body() body: UpsertBrandingSettingsDto) {
    const branding = await this.remindersService.upsertBrandingSettings({
      organizationId: body.organizationId,
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
      organizationId: body.organizationId,
      actorId: body.actorUserId,
      actorType: body.actorUserId ? 'user' : undefined,
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
  @Put('email-template-variants')
  async upsertEmailTemplateVariant(
    @Body() body: UpsertEmailTemplateVariantDto,
  ) {
    const templateVariant =
      await this.remindersService.upsertEmailTemplateVariant({
        organizationId: body.organizationId,
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
      organizationId: body.organizationId,
      actorId: body.actorUserId,
      actorType: body.actorUserId ? 'user' : undefined,
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
