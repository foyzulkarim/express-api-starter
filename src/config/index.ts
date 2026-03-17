import { envSchema, type Env } from './env.schema.js';

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(result.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const config: Env = result.data;
export type { Env };
