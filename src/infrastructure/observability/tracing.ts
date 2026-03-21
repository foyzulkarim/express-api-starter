import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base';

export function initTracing(): NodeSDK {
  const sdk = new NodeSDK({
    spanProcessors: [new NoopSpanProcessor()],
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  return sdk;
}

// Side effect: must be the first import in server.ts for auto-instrumentation to work.
// Call sdk.shutdown() during graceful shutdown (see server.ts).
export const sdk = initTracing();
