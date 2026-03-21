import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const mockStart = vi.fn();
const mockSdk = { start: mockStart };
const MockNodeSDK = vi.fn(() => mockSdk);
const MockNoopSpanProcessor = vi.fn();

vi.mock('@opentelemetry/sdk-node', () => ({ NodeSDK: MockNodeSDK }));
vi.mock('@opentelemetry/sdk-trace-base', () => ({
  NoopSpanProcessor: MockNoopSpanProcessor,
}));
vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn(() => 'mock-instrumentation'),
}));

let initTracing: typeof import('../tracing.js')['initTracing'];

beforeAll(async () => {
  // Module loads; module-level initTracing() runs with mocks (harmless).
  const mod = await import('../tracing.js');
  initTracing = mod.initTracing;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('initTracing', () => {
  it('creates a NodeSDK instance with auto-instrumentations', () => {
    initTracing();
    expect(MockNodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({ instrumentations: ['mock-instrumentation'] }),
    );
  });

  it('configures NodeSDK with NoopSpanProcessor', () => {
    initTracing();
    expect(MockNoopSpanProcessor).toHaveBeenCalledOnce();
    expect(MockNodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({ spanProcessors: [expect.any(MockNoopSpanProcessor)] }),
    );
  });

  it('calls sdk.start() during initialization', () => {
    initTracing();
    expect(mockStart).toHaveBeenCalledOnce();
  });

  it('returns the NodeSDK instance', () => {
    const result = initTracing();
    expect(result).toBe(mockSdk);
  });
});
