import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_REMINDER_PROVIDER_BY_CHANNEL,
  type ReminderChannel,
  type ReminderProvider,
} from '../../common/reminders/reminder-types';
import { DatabaseService } from '../database/database.service';
import {
  organizationBrandingSettings,
  organizationEmailTemplateVariants,
  organizationReminderProviderConfigs,
} from '../database/schema';
import { PlivoSmsReminderProvider } from './plivo-sms-reminder.provider';
import type {
  ReminderBrandingSettings,
  ReminderDispatchInput,
  ReminderDispatchResult,
  ReminderEmailTemplateVariant,
  ReminderProviderSendPayload,
} from './reminder-provider.types';
import { ResendEmailReminderProvider } from './resend-email-reminder.provider';
import { WhatsAppCloudReminderProvider } from './whatsapp-cloud-reminder.provider';

export interface UpsertReminderProviderConfigInput {
  organizationId: string;
  channel: ReminderChannel;
  provider: ReminderProvider;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface UpsertBrandingSettingsInput {
  organizationId: string;
  displayName: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  emailFromName?: string;
  emailReplyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertEmailTemplateVariantInput {
  organizationId: string;
  templateKey: string;
  locale?: string;
  resendTemplateId?: string;
  subjectTemplate: string;
  bodyTemplate: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class RemindersService {
  private readonly providerByKey = new Map<
    ReminderProvider,
    {
      channel: ReminderChannel;
      send(
        payload: ReminderProviderSendPayload,
      ): Promise<ReminderDispatchResult>;
    }
  >();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly whatsappProvider: WhatsAppCloudReminderProvider,
    private readonly plivoProvider: PlivoSmsReminderProvider,
    private readonly resendProvider: ResendEmailReminderProvider,
  ) {
    this.providerByKey.set(
      this.whatsappProvider.provider,
      this.whatsappProvider,
    );
    this.providerByKey.set(this.plivoProvider.provider, this.plivoProvider);
    this.providerByKey.set(this.resendProvider.provider, this.resendProvider);
  }

  async dispatchReminder(
    input: ReminderDispatchInput,
  ): Promise<ReminderDispatchResult> {
    const db = this.getDatabase();

    const [providerConfigRow] = await db
      .select()
      .from(organizationReminderProviderConfigs)
      .where(
        and(
          eq(
            organizationReminderProviderConfigs.organizationId,
            input.organizationId,
          ),
          eq(organizationReminderProviderConfigs.channel, input.channel),
          eq(organizationReminderProviderConfigs.enabled, true),
        ),
      )
      .limit(1);

    const provider =
      providerConfigRow?.provider ??
      DEFAULT_REMINDER_PROVIDER_BY_CHANNEL[input.channel];

    this.assertProviderMatchesChannel(input.channel, provider);

    const channelProvider = this.providerByKey.get(provider);

    if (!channelProvider) {
      throw new ServiceUnavailableException(
        `Reminder provider ${provider} is not registered.`,
      );
    }

    if (channelProvider.channel !== input.channel) {
      throw new BadRequestException(
        `Configured provider ${provider} cannot be used for channel ${input.channel}.`,
      );
    }

    const [brandingRow] = await db
      .select()
      .from(organizationBrandingSettings)
      .where(
        eq(organizationBrandingSettings.organizationId, input.organizationId),
      )
      .limit(1);

    const branding: ReminderBrandingSettings | undefined = brandingRow
      ? {
          displayName: brandingRow.displayName,
          logoUrl: brandingRow.logoUrl,
          primaryColor: brandingRow.primaryColor,
          secondaryColor: brandingRow.secondaryColor,
          emailFromName: brandingRow.emailFromName,
          emailReplyTo: brandingRow.emailReplyTo,
        }
      : undefined;

    let templateVariant: ReminderEmailTemplateVariant | undefined;

    if (input.templateKey) {
      const locale = input.locale?.trim() || 'en';
      templateVariant = await this.resolveTemplateVariant(
        input.organizationId,
        input.templateKey,
        locale,
      );
    }

    return channelProvider.send({
      ...input,
      providerConfig: providerConfigRow?.config ?? {},
      branding,
      templateVariant,
    });
  }

  async upsertProviderConfig(input: UpsertReminderProviderConfigInput) {
    const db = this.getDatabase();
    const now = new Date();

    this.assertProviderMatchesChannel(input.channel, input.provider);

    const [row] = await db
      .insert(organizationReminderProviderConfigs)
      .values({
        id: randomUUID(),
        organizationId: input.organizationId,
        channel: input.channel,
        provider: input.provider,
        enabled: input.enabled ?? true,
        config: input.config ?? {},
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          organizationReminderProviderConfigs.organizationId,
          organizationReminderProviderConfigs.channel,
        ],
        set: {
          provider: input.provider,
          enabled: input.enabled ?? true,
          config: input.config ?? {},
          updatedAt: now,
        },
      })
      .returning();

    return row;
  }

  async upsertBrandingSettings(input: UpsertBrandingSettingsInput) {
    const db = this.getDatabase();
    const now = new Date();

    const [row] = await db
      .insert(organizationBrandingSettings)
      .values({
        id: randomUUID(),
        organizationId: input.organizationId,
        displayName: input.displayName,
        logoUrl: input.logoUrl,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        emailFromName: input.emailFromName,
        emailReplyTo: input.emailReplyTo,
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [organizationBrandingSettings.organizationId],
        set: {
          displayName: input.displayName,
          logoUrl: input.logoUrl,
          primaryColor: input.primaryColor,
          secondaryColor: input.secondaryColor,
          emailFromName: input.emailFromName,
          emailReplyTo: input.emailReplyTo,
          metadata: input.metadata ?? {},
          updatedAt: now,
        },
      })
      .returning();

    return row;
  }

  async upsertEmailTemplateVariant(input: UpsertEmailTemplateVariantInput) {
    const db = this.getDatabase();
    const now = new Date();
    const locale = input.locale?.trim() || 'en';

    const [row] = await db
      .insert(organizationEmailTemplateVariants)
      .values({
        id: randomUUID(),
        organizationId: input.organizationId,
        templateKey: input.templateKey,
        locale,
        provider: 'resend',
        resendTemplateId: input.resendTemplateId,
        subjectTemplate: input.subjectTemplate,
        bodyTemplate: input.bodyTemplate,
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          organizationEmailTemplateVariants.organizationId,
          organizationEmailTemplateVariants.templateKey,
          organizationEmailTemplateVariants.locale,
        ],
        set: {
          provider: 'resend',
          resendTemplateId: input.resendTemplateId,
          subjectTemplate: input.subjectTemplate,
          bodyTemplate: input.bodyTemplate,
          metadata: input.metadata ?? {},
          updatedAt: now,
        },
      })
      .returning();

    return row;
  }

  private async resolveTemplateVariant(
    organizationId: string,
    templateKey: string,
    locale: string,
  ): Promise<ReminderEmailTemplateVariant | undefined> {
    const db = this.getDatabase();

    const [localizedVariant] = await db
      .select()
      .from(organizationEmailTemplateVariants)
      .where(
        and(
          eq(organizationEmailTemplateVariants.organizationId, organizationId),
          eq(organizationEmailTemplateVariants.templateKey, templateKey),
          eq(organizationEmailTemplateVariants.locale, locale),
        ),
      )
      .limit(1);

    if (localizedVariant) {
      return {
        templateKey: localizedVariant.templateKey,
        locale: localizedVariant.locale,
        resendTemplateId: localizedVariant.resendTemplateId,
        subjectTemplate: localizedVariant.subjectTemplate,
        bodyTemplate: localizedVariant.bodyTemplate,
      };
    }

    if (locale !== 'en') {
      const [fallbackVariant] = await db
        .select()
        .from(organizationEmailTemplateVariants)
        .where(
          and(
            eq(
              organizationEmailTemplateVariants.organizationId,
              organizationId,
            ),
            eq(organizationEmailTemplateVariants.templateKey, templateKey),
            eq(organizationEmailTemplateVariants.locale, 'en'),
          ),
        )
        .limit(1);

      if (fallbackVariant) {
        return {
          templateKey: fallbackVariant.templateKey,
          locale: fallbackVariant.locale,
          resendTemplateId: fallbackVariant.resendTemplateId,
          subjectTemplate: fallbackVariant.subjectTemplate,
          bodyTemplate: fallbackVariant.bodyTemplate,
        };
      }
    }

    return undefined;
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for reminder operations.',
      );
    }

    return this.databaseService.db;
  }

  private assertProviderMatchesChannel(
    channel: ReminderChannel,
    provider: ReminderProvider,
  ): void {
    const expectedProvider = DEFAULT_REMINDER_PROVIDER_BY_CHANNEL[channel];

    if (provider !== expectedProvider) {
      throw new BadRequestException(
        `Channel ${channel} must use provider ${expectedProvider}.`,
      );
    }
  }
}
