import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';

function makeStream(): { stream: Writable; getOutput: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      cb();
    },
  });
  return { stream, getOutput: () => Buffer.concat(chunks).toString('utf8') };
}

describe('buildLoggerOptions', () => {
  it('sets the level from config', async () => {
    const { buildLoggerOptions } = await import('../logger.js');
    const options = buildLoggerOptions({ level: 'debug', pretty: false, redactPaths: [] });
    expect(options.level).toBe('debug');
  });

  it('configures redact paths with [Redacted] censor', async () => {
    const { buildLoggerOptions } = await import('../logger.js');
    const options = buildLoggerOptions({
      level: 'info',
      pretty: false,
      redactPaths: ['password', 'token'],
    });
    expect(options.redact).toEqual({ paths: ['password', 'token'], censor: '[Redacted]' });
  });

  it('includes pino-pretty transport when pretty is true', async () => {
    const { buildLoggerOptions } = await import('../logger.js');
    const options = buildLoggerOptions({ level: 'info', pretty: true, redactPaths: [] });
    expect(options.transport).toEqual({ target: 'pino-pretty' });
  });

  it('omits transport when pretty is false', async () => {
    const { buildLoggerOptions } = await import('../logger.js');
    const options = buildLoggerOptions({ level: 'info', pretty: false, redactPaths: [] });
    expect(options).not.toHaveProperty('transport');
  });
});

describe('createLogger', () => {
  it('returns a logger with the configured level', async () => {
    const { createLogger } = await import('../logger.js');
    const { stream } = makeStream();
    const logger = createLogger({ level: 'debug', pretty: false, redactPaths: [] }, stream);
    expect(logger.level).toBe('debug');
  });

  it('writes JSON-formatted logs to the provided destination', async () => {
    const { createLogger } = await import('../logger.js');
    const { stream, getOutput } = makeStream();
    const logger = createLogger({ level: 'info', pretty: false, redactPaths: [] }, stream);
    logger.info({ event: 'test' }, 'hello');
    await new Promise((r) => setImmediate(r));
    const line = JSON.parse(getOutput().trim());
    expect(line.msg).toBe('hello');
    expect(line.event).toBe('test');
  });

  it('redacts configured paths from log output', async () => {
    const { createLogger } = await import('../logger.js');
    const { stream, getOutput } = makeStream();
    const logger = createLogger(
      { level: 'info', pretty: false, redactPaths: ['password'] },
      stream,
    );
    logger.info({ password: 'secret123' }, 'user login');
    await new Promise((r) => setImmediate(r));
    const line = JSON.parse(getOutput().trim());
    expect(line.password).toBe('[Redacted]');
  });
});
