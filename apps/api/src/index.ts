import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Hono } from 'hono';
import { fixturesRoutes } from './modules/fixtures/fixtures.routes';
import { timezonesRoutes } from './modules/timezones/timezones.routes';

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

const app = new Hono();

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// API routes
app.route('/fixtures', fixturesRoutes);
app.route('/timezones', timezonesRoutes);

// Error handling
app.onError((err, c) => {
  console.error('Global error:', err);
  return c.json({
    success: false,
    error: 'Internal server error',
  }, 500);
});

export default app;  