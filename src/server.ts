import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { generateExcelCsv, generateUniversitiesCsv } from './exporter';
import { renderDashboardHtml } from './ui';
import { UNIVERSITIES_DATA } from './universities-data';
import { getDatabase, closeDatabase } from './db';
import { getRedisClient, closeRedis } from './redis';
import { getPositions } from './positions-service';

const PORT = Number(process.env.PORT) || 8787;

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', cors());

  app.get('/', async (c) => {
    const apiKey = c.req.header('x-gemini-api-key') || process.env.GEMINI_API_KEY;
    const positions = await getPositions(false, apiKey);
    return c.html(renderDashboardHtml(positions, UNIVERSITIES_DATA));
  });

  app.get('/api/jobs', async (c) => {
    const apiKey = c.req.header('x-gemini-api-key') || process.env.GEMINI_API_KEY;
    const positions = await getPositions(false, apiKey);
    const verifiedCount = positions.filter((p) => p.verificationStatus !== 'Rejected').length;
    const rejectedCount = positions.filter((p) => p.verificationStatus === 'Rejected').length;
    return c.json({ count: positions.length, verifiedCount, rejectedCount, positions });
  });

  app.post('/api/scan', async (c) => {
    const apiKey = c.req.header('x-gemini-api-key') || process.env.GEMINI_API_KEY;
    const positions = await getPositions(true, apiKey);
    const verifiedCount = positions.filter((p) => p.verificationStatus !== 'Rejected').length;
    const rejectedCount = positions.filter((p) => p.verificationStatus === 'Rejected').length;
    return c.json({
      success: true,
      count: positions.length,
      verifiedCount,
      rejectedCount,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/universities', (c) => {
    return c.json({ count: UNIVERSITIES_DATA.length, universities: UNIVERSITIES_DATA });
  });

  app.get('/api/export', async (c) => {
    const apiKey = c.req.header('x-gemini-api-key') || process.env.GEMINI_API_KEY;
    const positions = await getPositions(false, apiKey);
    return c.text(generateExcelCsv(positions), 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="german_phd_positions.csv"',
    });
  });

  app.get('/api/export-universities', (c) => {
    return c.text(generateUniversitiesCsv(UNIVERSITIES_DATA), 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="western_german_universities.csv"',
    });
  });

  return app;
}

const app = createApp();

// Initialize dependencies
getDatabase();
getRedisClient();

// Start server
const server = serve({ fetch: app.fetch, port: PORT });

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down cleanly...`);
  server.close(async () => {
    closeDatabase();
    await closeRedis();
    process.exit(0);
  });

  // Force close after 5 seconds if hanging
  setTimeout(() => {
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

export default app;
