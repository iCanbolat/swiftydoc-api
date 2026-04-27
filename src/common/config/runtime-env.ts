import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return value;
}, z.boolean());

const numberFromEnv = z.preprocess((value) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }

  return value;
}, z.number().int().positive());

export const runtimeEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: numberFromEnv.default(8080),
    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_POOL_MAX: numberFromEnv.default(10),
    DATABASE_SSL: booleanFromEnv.default(false),
    AUTH_BOOTSTRAP_ALLOW_SIGNUP: booleanFromEnv.default(true),
    INTERNAL_AUTH_ALLOWED_ORIGINS: z
      .string()
      .min(1)
      .default('http://localhost:5173,http://127.0.0.1:5173'),
    INTERNAL_AUTH_ACCESS_TOKEN_TTL_MINUTES: numberFromEnv.default(60),
    INTERNAL_AUTH_REFRESH_TOKEN_TTL_DAYS: numberFromEnv.default(30),
    INTERNAL_AUTH_REFRESH_COOKIE_NAME: z
      .string()
      .min(1)
      .default('swd_refresh_token'),
    INTERNAL_AUTH_REFRESH_COOKIE_PATH: z.string().min(1).default('/v1/auth'),
    INTERNAL_AUTH_REFRESH_COOKIE_DOMAIN: z.string().min(1).optional(),
    INTERNAL_AUTH_REFRESH_COOKIE_SAME_SITE: z
      .enum(['strict', 'lax', 'none'])
      .default('strict'),
    INTERNAL_AUTH_REFRESH_COOKIE_SECURE: booleanFromEnv.optional(),
    INTERNAL_AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS: numberFromEnv.optional(),
    INTERNAL_AUTH_INVITE_TOKEN_TTL_HOURS: numberFromEnv.default(72),
    INTERNAL_AUTH_INVITE_URL_BASE: z
      .string()
      .url()
      .default('http://localhost:5173/accept-invite'),
    INTERNAL_AUTH_GOOGLE_STATE_SECRET: z
      .string()
      .min(16)
      .default('swiftydoc-google-auth-state-secret-local-1234567890'),
    INTERNAL_AUTH_GOOGLE_STATE_TTL_MINUTES: numberFromEnv.default(15),
    INTERNAL_AUTH_EMAIL_VERIFICATION_URL_BASE: z
      .string()
      .url()
      .default('http://localhost:5173/verify-email'),
    INTERNAL_AUTH_PASSWORD_RESET_URL_BASE: z
      .string()
      .url()
      .default('http://localhost:5173/reset-password'),
    PORTAL_AUTH_TOKEN_TTL_MINUTES: numberFromEnv.default(30),
    PORTAL_AUTH_TOKEN_SECRET: z
      .string()
      .min(16)
      .default('swiftydoc-portal-auth-secret-local-1234567890'),
    PASSWORD_RESET_TOKEN_TTL_MINUTES: numberFromEnv.default(30),
    EMAIL_VERIFICATION_TOKEN_TTL_HOURS: numberFromEnv.default(24),
    HTTP_TRUST_PROXY: booleanFromEnv.default(false),
    RATE_LIMIT_TTL_MS: numberFromEnv.default(60000),
    RATE_LIMIT_MAX: numberFromEnv.default(120),
    WEBHOOK_DELIVERY_TIMEOUT_MS: numberFromEnv.default(5000),
    FILE_UPLOAD_MAX_BYTES: numberFromEnv.default(10485760),
    FILE_UPLOAD_ALLOWED_MIME_TYPES: z
      .string()
      .min(1)
      .default(
        'application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv,application/zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    STORAGE_DRIVER: z.enum(['local', 'bunny']).default('local'),
    LOCAL_STORAGE_PATH: z.string().min(1).default('./storage'),
    BUNNY_STORAGE_ZONE: z.string().min(1).optional(),
    BUNNY_STORAGE_REGION: z.string().min(1).optional(),
    BUNNY_STORAGE_API_KEY: z.string().min(1).optional(),
    BUNNY_PULL_ZONE_BASE_URL: z.string().url().optional(),
    WHATSAPP_CLOUD_API_BASE_URL: z
      .string()
      .url()
      .default('https://graph.facebook.com'),
    WHATSAPP_CLOUD_API_VERSION: z.string().min(1).default('v23.0'),
    WHATSAPP_CLOUD_API_TOKEN: z.string().min(1).optional(),
    WHATSAPP_CLOUD_API_PHONE_NUMBER_ID: z.string().min(1).optional(),
    PLIVO_AUTH_ID: z.string().min(1).optional(),
    PLIVO_AUTH_TOKEN: z.string().min(1).optional(),
    PLIVO_FROM_NUMBER: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_DEFAULT_FROM_EMAIL: z.string().email().optional(),
    ZOHO_BOOKS_API_BASE_URL: z
      .string()
      .url()
      .default('https://www.zohoapis.com/books/v3'),
    ZOHO_BOOKS_ACCESS_TOKEN: z.string().min(1).optional(),
    ZOHO_BOOKS_ORGANIZATION_ID: z.string().min(1).optional(),
    ODOO_API_BASE_URL: z.string().url().optional(),
    ODOO_DATABASE: z.string().min(1).optional(),
    ODOO_USERNAME: z.string().min(1).optional(),
    ODOO_PASSWORD: z.string().min(1).optional(),
    ODOO_API_KEY: z.string().min(1).optional(),
    GOOGLE_OIDC_AUTH_URL: z
      .string()
      .url()
      .default('https://accounts.google.com/o/oauth2/v2/auth'),
    GOOGLE_OIDC_TOKEN_URL: z
      .string()
      .url()
      .default('https://oauth2.googleapis.com/token'),
    GOOGLE_OIDC_USERINFO_URL: z
      .string()
      .url()
      .default('https://openidconnect.googleapis.com/v1/userinfo'),
    GOOGLE_OIDC_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_OIDC_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_OIDC_REDIRECT_URI: z.string().url().optional(),
    GOOGLE_OIDC_SCOPE: z.string().min(1).default('openid email profile'),
    GOOGLE_DRIVE_API_BASE_URL: z
      .string()
      .url()
      .default('https://www.googleapis.com/drive/v3'),
    GOOGLE_DRIVE_ACCESS_TOKEN: z.string().min(1).optional(),
    GOOGLE_DRIVE_FOLDER_ID: z.string().min(1).optional(),
    ONEDRIVE_SHAREPOINT_GRAPH_BASE_URL: z
      .string()
      .url()
      .default('https://graph.microsoft.com/v1.0'),
    ONEDRIVE_SHAREPOINT_ACCESS_TOKEN: z.string().min(1).optional(),
    ONEDRIVE_SHAREPOINT_DRIVE_ID: z.string().min(1).optional(),
    ONEDRIVE_SHAREPOINT_SITE_ID: z.string().min(1).optional(),
    ONEDRIVE_SHAREPOINT_ITEM_ID: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (parseOriginList(env.INTERNAL_AUTH_ALLOWED_ORIGINS).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'INTERNAL_AUTH_ALLOWED_ORIGINS must contain at least one origin.',
        path: ['INTERNAL_AUTH_ALLOWED_ORIGINS'],
      });
    }

    if (
      env.INTERNAL_AUTH_REFRESH_COOKIE_SAME_SITE === 'none' &&
      env.INTERNAL_AUTH_REFRESH_COOKIE_SECURE !== true
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'INTERNAL_AUTH_REFRESH_COOKIE_SECURE must be true when SameSite=None.',
        path: ['INTERNAL_AUTH_REFRESH_COOKIE_SECURE'],
      });
    }

    if (env.NODE_ENV !== 'test' && !env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DATABASE_URL is required outside test environments.',
        path: ['DATABASE_URL'],
      });
    }

    if (env.STORAGE_DRIVER === 'bunny') {
      const requiredKeys = [
        'BUNNY_STORAGE_ZONE',
        'BUNNY_STORAGE_REGION',
        'BUNNY_STORAGE_API_KEY',
        'BUNNY_PULL_ZONE_BASE_URL',
      ] as const;

      for (const key of requiredKeys) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} is required when STORAGE_DRIVER=bunny.`,
            path: [key],
          });
        }
      }
    }

    const googleOidcRequiredKeys = [
      'GOOGLE_OIDC_CLIENT_ID',
      'GOOGLE_OIDC_CLIENT_SECRET',
      'GOOGLE_OIDC_REDIRECT_URI',
    ] as const;
    const hasAnyGoogleOidcKey = googleOidcRequiredKeys.some(
      (key) => !!env[key],
    );

    if (hasAnyGoogleOidcKey) {
      for (const key of googleOidcRequiredKeys) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} is required when Google OIDC is partially configured.`,
            path: [key],
          });
        }
      }
    }
  });

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function validateRuntimeEnv(
  config: Record<string, unknown>,
): RuntimeEnv {
  return runtimeEnvSchema.parse(config);
}

export function parseOriginList(value: string): string[] {
  const uniqueOrigins = new Set(
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );

  return [...uniqueOrigins];
}
