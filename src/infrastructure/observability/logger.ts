import pino from 'pino';

export interface LoggerConfig {
  level: string;
  pretty: boolean;
  redactPaths: readonly string[];
}

export function buildLoggerOptions(config: LoggerConfig): pino.LoggerOptions {
  return {
    level: config.level,
    redact: { paths: [...config.redactPaths], censor: '[Redacted]' },
    ...(config.pretty ? { transport: { target: 'pino-pretty' } } : {}),
  };
}

export function createLogger(
  config: LoggerConfig,
  destination?: pino.DestinationStream,
): pino.Logger {
  const options = buildLoggerOptions(config);
  return destination ? pino(options, destination) : pino(options);
}

export type Logger = pino.Logger;
