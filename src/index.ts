import { PhDPosition } from './types';
import { scanFeeds } from './scanner';
import { generateExcelCsv, generateUniversitiesCsv, generateEnglishJobsCsv } from './exporter';
import { renderDashboardHtml } from './ui';
import { UNIVERSITIES_DATA } from './universities-data';
import { JOBS_GOTTINGEN_DATA } from './jobs-gottingen-data';

export interface Env {
  GEMINI_API_KEY?: string;
}

// In-memory cache for the worker isolate
let cachedPositions: PhDPosition[] = [];
let lastScanTimestamp: number = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getOrUpdatePositions(forceRefresh = false, apiKey?: string): Promise<PhDPosition[]> {
  const now = Date.now();
  if (forceRefresh || cachedPositions.length === 0 || now - lastScanTimestamp > CACHE_TTL_MS) {
    const freshPositions = await scanFeeds(apiKey);
    if (freshPositions.length > 0) {
      cachedPositions = freshPositions;
      lastScanTimestamp = now;
    }
  }
  return cachedPositions;
}

export default {
  async fetch(request: Request, env?: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const headerApiKey = request.headers.get('x-gemini-api-key') || undefined;
    const apiKey = headerApiKey || env?.GEMINI_API_KEY;

    // Route: GET /favicon.ico -> Return 204 No Content to prevent 404 logs
    if (pathname === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }

    // Route: GET /api/export -> Download Excel CSV file of verified ready-to-apply jobs
    if (pathname === '/api/export') {
      const positions = await getOrUpdatePositions(false, apiKey);
      const csv = generateExcelCsv(positions);

      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="german_phd_positions.csv"',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Route: GET /api/export-universities -> Download Excel CSV file of 44 universities & professors
    if (pathname === '/api/export-universities') {
      const csv = generateUniversitiesCsv(UNIVERSITIES_DATA);

      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="western_german_universities.csv"',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Route: GET /api/export-gottingen-jobs -> Download Excel CSV file of verified English jobs
    if (pathname === '/api/export-gottingen-jobs') {
      const csv = generateEnglishJobsCsv(JOBS_GOTTINGEN_DATA);

      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="gottingen_remote_english_jobs.csv"',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Route: GET /api/gottingen-jobs -> JSON list of verified English jobs
    if (pathname === '/api/gottingen-jobs') {
      return new Response(JSON.stringify({ count: JOBS_GOTTINGEN_DATA.length, jobs: JOBS_GOTTINGEN_DATA }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Route: GET /api/universities -> JSON list of 44 universities
    if (pathname === '/api/universities') {
      return new Response(JSON.stringify({ count: UNIVERSITIES_DATA.length, universities: UNIVERSITIES_DATA }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Route: GET /api/jobs -> JSON list of positions with verification statistics
    if (pathname === '/api/jobs') {
      const positions = await getOrUpdatePositions(false, apiKey);
      const verifiedCount = positions.filter((p) => p.verificationStatus !== 'Rejected').length;
      const rejectedCount = positions.filter((p) => p.verificationStatus === 'Rejected').length;

      return new Response(
        JSON.stringify({
          count: positions.length,
          verifiedCount,
          rejectedCount,
          positions,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Route: POST /api/scan or GET /api/scan -> Manual trigger to scan & deep-verify feeds
    if (pathname === '/api/scan') {
      const positions = await getOrUpdatePositions(true, apiKey);
      const verifiedCount = positions.filter((p) => p.verificationStatus !== 'Rejected').length;
      const rejectedCount = positions.filter((p) => p.verificationStatus === 'Rejected').length;

      return new Response(
        JSON.stringify({
          success: true,
          count: positions.length,
          verifiedCount,
          rejectedCount,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    // Route: GET / -> Interactive HTML dashboard
    if (pathname === '/' || pathname === '/index.html') {
      const positions = await getOrUpdatePositions(false, apiKey);
      const html = renderDashboardHtml(positions, UNIVERSITIES_DATA, JOBS_GOTTINGEN_DATA);

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  // Daily Cron Trigger
  async scheduled(event: { scheduledTime: number }, env?: Env): Promise<void> {
    console.log('Running daily scheduled PhD scanner at:', new Date(event.scheduledTime).toISOString());
    await getOrUpdatePositions(true, env?.GEMINI_API_KEY);
  },
};
