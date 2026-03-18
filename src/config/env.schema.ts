import { z } from 'zod';

const MAX_JWT_EXPIRY = '24h';
const KNOWN_WEAK_SECRETS = ['secret', 'password', '12345678', 'qwerty', 'changeme'];

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .refine((val) => val.startsWith('postgresql://') || val.startsWith('postgres://'), {
      message: 'DATABASE_URL must use postgresql:// or postgres:// scheme',
    }),
  REDIS_URL: z
    .string()
    .url()
    .refine((val) => val.startsWith('redis://') || val.startsWith('rediss://'), {
      message: 'REDIS_URL must use redis:// or rediss:// scheme',
    }),
  JWT_SECRET: z
    .string()
    .min(32)
    .refine(
      (val) => new Set(val).size >= 8,
      { message: 'JWT_SECRET has insufficient character diversity; use a cryptographically random value (e.g. openssl rand -hex 32)' },
    )
    .refine(
      (val) => {
        if (process.env.NODE_ENV !== 'production') return true;
        return !KNOWN_WEAK_SECRETS.some((s) => val.toLowerCase().includes(s));
      },
      { message: 'JWT_SECRET appears weak; use a cryptographically random value' },
    ),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, {
      message: 'JWT_EXPIRES_IN must match format: number + unit (s, m, h, d)',
    })
    .refine(
      (val) => {
        const unit = val.slice(-1);
        const num = parseInt(val.slice(0, -1), 10);
        const maxHours = { s: num / 3600, m: num / 60, h: num, d: num * 24 };
        return maxHours[unit as keyof typeof maxHours] <= 24;
      },
      { message: `JWT_EXPIRES_IN cannot exceed ${MAX_JWT_EXPIRY}` },
    )
    .default('15m'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('*')
    .superRefine((val, ctx) => {
      if (process.env.NODE_ENV === 'production' && val === '*') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CORS wildcard (*) not allowed in production',
        });
      }
    }),
});

export type Env = z.infer<typeof envSchema>;
