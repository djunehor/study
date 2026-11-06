import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { generateExcelCsv, generateUniversitiesCsv, generateEnglishJobsCsv } from './exporter';
import { renderDashboardHtml } from './ui';
import { UNIVERSITIES_DATA } from './universities-data';
import { JOBS_GOTTINGEN_DATA } from './jobs-gottingen-data';
import { initDatabase } from './db';
import { getPositions } from './positions-service';

const PORT = Number(process.env.PORT) || 8787;

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', cors());

  app.get('/', async (c) => {
    const apiKey = c.req.header('x-gemini-api-key') || process.env.GEMINI_API_KEY;
    const positions = await getPositions(false, apiKey);
    return c.html(renderDashboardHtml(positions, UNIVERSITIES_DATA, JOBS_GOTTINGEN_DATA));
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

  app.get('/api/gottingen-jobs', (c) => {
    return c.json({ count: JOBS_GOTTINGEN_DATA.length, jobs: JOBS_GOTTINGEN_DATA });
  });

  app.get('/api/export-gottingen-jobs', (c) => {
    return c.text(generateEnglishJobsCsv(JOBS_GOTTINGEN_DATA), 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="gottingen_remote_english_jobs.csv"',
    });
  });

  return app;
}

const app = createApp();

initDatabase();

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`Server listening on http://localhost:${info.port}`);
  }
);

export default app;
