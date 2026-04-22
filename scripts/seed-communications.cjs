const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

function readBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function normalizeSlug(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized.length === 0) {
    return `seed-${randomUUID().slice(0, 8)}`;
  }

  return normalized.slice(0, 64);
}

function withSuffix(base, suffix) {
  const maxBaseLength = Math.max(1, 64 - suffix.length - 1);
  const trimmedBase = base.slice(0, maxBaseLength);
  return `${trimmedBase}-${suffix}`;
}

async function ensureOrganization(client, options) {
  const existingOrg = await client.query(
    'select id from organizations where id = $1 limit 1',
    [options.organizationId],
  );

  if (existingOrg.rowCount > 0) {
    return {
      id: options.organizationId,
      created: false,
    };
  }

  if (!options.bootstrapDemoOrg) {
    throw new Error(
      `Organization ${options.organizationId} not found. Set SEED_BOOTSTRAP_DEMO_ORG=true or pass an existing SEED_ORGANIZATION_ID.`,
    );
  }

  let slug = normalizeSlug(options.organizationSlug);
  const slugConflict = await client.query(
    'select id from organizations where slug = $1 limit 1',
    [slug],
  );

  if (
    slugConflict.rowCount > 0 &&
    slugConflict.rows[0].id !== options.organizationId
  ) {
    slug = withSuffix(slug, randomUUID().slice(0, 8));
  }

  await client.query(
    `insert into organizations (
      id,
      slug,
      display_name,
      legal_name,
      default_locale,
      primary_region,
      timezone,
      plan_tier,
      data_residency_policy,
      status,
      created_at
    ) values (
      $1,
      $2,
      $3,
      $4,
      'en',
      'mena',
      'UTC',
      'foundation',
      'standard',
      'active',
      now()
    )`,
    [
      options.organizationId,
      slug,
      options.brandDisplayName,
      options.brandDisplayName,
    ],
  );

  return {
    id: options.organizationId,
    created: true,
  };
}

async function upsertBranding(client, options) {
  const row = await client.query(
    `insert into organization_branding_settings (
      id,
      organization_id,
      display_name,
      logo_url,
      primary_color,
      secondary_color,
      email_from_name,
      email_reply_to,
      metadata,
      created_at,
      updated_at
    ) values (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9::jsonb,
      now(),
      now()
    )
    on conflict (organization_id) do update set
      display_name = excluded.display_name,
      logo_url = excluded.logo_url,
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      email_from_name = excluded.email_from_name,
      email_reply_to = excluded.email_reply_to,
      metadata = excluded.metadata,
      updated_at = now()
    returning id`,
    [
      randomUUID(),
      options.organizationId,
      options.brandDisplayName,
      options.brandLogoUrl,
      options.brandPrimaryColor,
      options.brandSecondaryColor,
      options.brandEmailFromName,
      options.brandEmailReplyTo,
      JSON.stringify({ seededBy: 'db:seed:communications' }),
    ],
  );

  return row.rows[0].id;
}

async function upsertProviderConfigs(client, options) {
  const providerRows = [
    {
      channel: 'whatsapp',
      provider: 'whatsapp_cloud_api',
      config: {
        accessToken: options.whatsappAccessToken,
        apiVersion: options.whatsappApiVersion,
        baseUrl: options.whatsappBaseUrl,
        phoneNumberId: options.whatsappPhoneNumberId,
      },
    },
    {
      channel: 'sms',
      provider: 'plivo',
      config: {
        authId: options.plivoAuthId,
        authToken: options.plivoAuthToken,
        fromNumber: options.plivoFromNumber,
      },
    },
    {
      channel: 'email',
      provider: 'resend',
      config: {
        apiKey: options.resendApiKey,
        fromEmail: options.resendFromEmail,
      },
    },
  ];

  for (const row of providerRows) {
    await client.query(
      `insert into organization_reminder_provider_configs (
        id,
        organization_id,
        channel,
        provider,
        enabled,
        config,
        created_at,
        updated_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        true,
        $5::jsonb,
        now(),
        now()
      )
      on conflict (organization_id, channel) do update set
        provider = excluded.provider,
        enabled = excluded.enabled,
        config = excluded.config,
        updated_at = now()`,
      [
        randomUUID(),
        options.organizationId,
        row.channel,
        row.provider,
        JSON.stringify(row.config),
      ],
    );
  }
}

async function upsertEmailTemplates(client, options, brandingSettingId) {
  const templates = [
    {
      templateKey: 'request_reminder',
      subjectTemplate: 'Reminder: {{requestCode}} is waiting',
      bodyTemplate:
        'Hello {{clientName}}, please complete request {{requestCode}} at {{portalUrl}}.',
    },
    {
      templateKey: 'request_overdue_reminder',
      subjectTemplate: 'Overdue reminder: {{requestCode}}',
      bodyTemplate:
        'Hello {{clientName}}, request {{requestCode}} is overdue. Please complete it at {{portalUrl}}.',
    },
  ];

  for (const template of templates) {
    await client.query(
      `insert into organization_email_template_variants (
        id,
        organization_id,
        template_key,
        locale,
        provider,
        branding_setting_id,
        resend_template_id,
        subject_template,
        body_template,
        metadata,
        created_at,
        updated_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        'resend',
        $5,
        $6,
        $7,
        $8,
        $9::jsonb,
        now(),
        now()
      )
      on conflict (organization_id, template_key, locale) do update set
        provider = excluded.provider,
        branding_setting_id = excluded.branding_setting_id,
        resend_template_id = excluded.resend_template_id,
        subject_template = excluded.subject_template,
        body_template = excluded.body_template,
        metadata = excluded.metadata,
        updated_at = now()`,
      [
        randomUUID(),
        options.organizationId,
        template.templateKey,
        options.templateLocale,
        brandingSettingId,
        options.resendTemplateId || null,
        template.subjectTemplate,
        template.bodyTemplate,
        JSON.stringify({ seededBy: 'db:seed:communications' }),
      ],
    );
  }
}

function readOptions() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const organizationId = process.env.SEED_ORGANIZATION_ID || 'org_demo';
  const organizationSlug =
    process.env.SEED_ORGANIZATION_SLUG || `seed-${organizationId}`;

  return {
    databaseUrl,
    organizationId,
    organizationSlug,
    bootstrapDemoOrg: readBoolean(process.env.SEED_BOOTSTRAP_DEMO_ORG, true),
    brandDisplayName: process.env.SEED_BRAND_DISPLAY_NAME || 'SwiftyDoc Demo',
    brandLogoUrl: process.env.SEED_BRAND_LOGO_URL || null,
    brandPrimaryColor: process.env.SEED_BRAND_PRIMARY_COLOR || '#0A1F44',
    brandSecondaryColor: process.env.SEED_BRAND_SECONDARY_COLOR || '#14B8A6',
    brandEmailFromName:
      process.env.SEED_BRAND_EMAIL_FROM_NAME || 'SwiftyDoc Demo Team',
    brandEmailReplyTo:
      process.env.SEED_BRAND_EMAIL_REPLY_TO || 'support@example.com',
    templateLocale: process.env.SEED_TEMPLATE_LOCALE || 'en',
    resendTemplateId: process.env.SEED_RESEND_TEMPLATE_ID || '',
    whatsappBaseUrl:
      process.env.WHATSAPP_CLOUD_API_BASE_URL || 'https://graph.facebook.com',
    whatsappApiVersion: process.env.WHATSAPP_CLOUD_API_VERSION || 'v23.0',
    whatsappAccessToken:
      process.env.WHATSAPP_CLOUD_API_TOKEN || 'replace_with_whatsapp_token',
    whatsappPhoneNumberId:
      process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID ||
      'replace_with_phone_number_id',
    plivoAuthId: process.env.PLIVO_AUTH_ID || 'replace_with_plivo_auth_id',
    plivoAuthToken:
      process.env.PLIVO_AUTH_TOKEN || 'replace_with_plivo_auth_token',
    plivoFromNumber:
      process.env.PLIVO_FROM_NUMBER || 'replace_with_plivo_from_number',
    resendApiKey: process.env.RESEND_API_KEY || 'replace_with_resend_api_key',
    resendFromEmail:
      process.env.RESEND_DEFAULT_FROM_EMAIL || 'noreply@example.com',
  };
}

async function main() {
  const options = readOptions();
  const pool = new Pool({
    connectionString: options.databaseUrl,
  });

  const client = await pool.connect();

  try {
    await client.query('begin');

    const org = await ensureOrganization(client, options);
    const brandingSettingId = await upsertBranding(client, options);

    await upsertProviderConfigs(client, options);
    await upsertEmailTemplates(client, options, brandingSettingId);

    await client.query('commit');

    console.log('[ok] Communications seed completed.');
    console.log(`[info] organization_id=${options.organizationId}`);
    console.log(`[info] organization_created=${org.created}`);
    console.log(`[info] branding_setting_id=${brandingSettingId}`);
    console.log('[info] providers=whatsapp_cloud_api,plivo,resend');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[error] Communications seed failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
