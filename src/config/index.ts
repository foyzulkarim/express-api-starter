import { envSchema, type Env } from './env.schema.js';

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const fieldErrors = result.error.flatten().fieldErrors;
  const safeFields = Object.keys(fieldErrors);
  const errorPayload = {
    fatal: true,
    message: 'Invalid environment variables',
    fields: safeFields,
  };
  process.stderr.write(JSON.stringify(errorPayload) + '\n');
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
}

export const config: Env = result.data as Env;
export type { Env };
