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
    PORT: numberFromEnv.default(3000),
    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_POOL_MAX: numberFromEnv.default(10),
    DATABASE_SSL: booleanFromEnv.default(false),
    RATE_LIMIT_TTL_MS: numberFromEnv.default(60000),
    RATE_LIMIT_MAX: numberFromEnv.default(120),
    WEBHOOK_DELIVERY_TIMEOUT_MS: numberFromEnv.default(5000),
    STORAGE_DRIVER: z.enum(['local', 'bunny']).default('local'),
    LOCAL_STORAGE_PATH: z.string().min(1).default('./storage'),
    BUNNY_STORAGE_ZONE: z.string().min(1).optional(),
    BUNNY_STORAGE_REGION: z.string().min(1).optional(),
    BUNNY_STORAGE_API_KEY: z.string().min(1).optional(),
    BUNNY_PULL_ZONE_BASE_URL: z.string().url().optional(),
  })
  .superRefine((env, ctx) => {
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
  });

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function validateRuntimeEnv(
  config: Record<string, unknown>,
): RuntimeEnv {
  return runtimeEnvSchema.parse(config);
}
