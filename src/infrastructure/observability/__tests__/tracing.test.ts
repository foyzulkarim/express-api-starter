import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const mockStart = vi.fn();
const mockSdk = { start: mockStart };
const MockNodeSDK = vi.fn(() => mockSdk);

const mockExporter = {};
const MockNoopSpanExporter = vi.fn(() => mockExporter);

vi.mock('@opentelemetry/sdk-node', () => ({ NodeSDK: MockNodeSDK }));
vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn(() => 'mock-instrumentation'),
}));
vi.mock('@opentelemetry/sdk-trace-base', () => ({
  NoopSpanExporter: MockNoopSpanExporter,
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
  it('creates a NodeSDK instance with NoopSpanExporter', () => {
    initTracing();
    expect(MockNoopSpanExporter).toHaveBeenCalledOnce();
    expect(MockNodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({ traceExporter: mockExporter }),
    );
  });

  it('creates a NodeSDK instance with auto-instrumentations', () => {
    initTracing();
    expect(MockNodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({ instrumentations: ['mock-instrumentation'] }),
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
