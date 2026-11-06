import { describe, it, expect } from 'vitest';
import { renderDashboardHtml } from '../src/ui';
import { PhDPosition } from '../src/types';
import { UNIVERSITIES_DATA } from '../src/universities-data';
import worker from '../src/index';

describe('UI and Mobile Responsiveness', () => {
  const samplePositions: PhDPosition[] = [
    {
      id: 'job-101',
      title: 'PhD in Comparative Employment Systems',
      employer: 'Universität Mannheim',
      location: '68131 Mannheim',
      postalCode: '68131',
      state: 'Baden-Württemberg',
      isWestGermany: true,
      publicationDate: '2026-11-05',
      deadline: '2026-12-31',
      link: 'https://example.com/job/101',
      matchedKeywords: ['employment relations', 'phd'],
      isEnglishPreferred: true,
      description: 'Fully funded TV-L E13 position in social sciences.',
      source: 'service.bund.de',
      verificationStatus: 'Verified Match',
      matchScore: 95,
    },
  ];

  it('renders required HTML5, tabs, and responsive viewport metadata', () => {
    const html = renderDashboardHtml(samplePositions, UNIVERSITIES_DATA);

    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    expect(html).toContain('German PhD Position Scanner & University Directory');
    expect(html).toContain('@media (max-width: 768px)');
    expect(html).toContain('Download Vacancies (CSV)');
    expect(html).toContain('Download 44 Universities (CSV)');
    expect(html).toContain('Scan Feed Websites Now');
    expect(html).toContain('44 Western Universities & Professors');
    expect(html).toContain('Hide Rejected Listings (Show Ready-to-Apply Only)');
    expect(html).toContain('Exclude Former DDR States');
    expect(html).toContain('English Preferred Only');
    expect(html).toContain('Window, Deadline & Action');
    expect(html).toContain('Application Window & Deadline');
  });

  it('embeds JSON data for client-side responsive filtering', () => {
    const html = renderDashboardHtml(samplePositions, UNIVERSITIES_DATA);
    expect(html).toContain('job-101');
    expect(html).toContain('Universität Mannheim');
    expect(html).toContain('Max Planck Institute for the Study of Societies');
    expect(html).toContain('University of Siegen');
  });
});

describe('Cloudflare Worker Endpoint Handling', () => {
  it('handles GET /favicon.ico with 204 No Content', async () => {
    const request = new Request('https://worker.local/favicon.ico');
    const response = await worker.fetch(request);
    expect(response.status).toBe(204);
  });

  it('handles GET / and returns mobile-responsive HTML', async () => {
    const request = new Request('https://worker.local/');
    const response = await worker.fetch(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('viewport');
    expect(html).toContain('German PhD Position Scanner & University Directory');
  }, 30000);

  it('handles GET /api/export and returns Excel CSV with attachment header', async () => {
    const request = new Request('https://worker.local/api/export');
    const response = await worker.fetch(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('attachment; filename="german_phd_positions.csv"');

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);

    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(bytes);
    expect(text).toContain('Job ID,Title');
  }, 30000);

  it('handles GET /api/export-universities and returns 44 universities CSV', async () => {
    const request = new Request('https://worker.local/api/export-universities');
    const response = await worker.fetch(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('attachment; filename="western_german_universities.csv"');

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);

    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(bytes);
    expect(text).toContain('ID,Institution Name,Federal State,City / Region');
  });

  it('handles GET /api/universities and returns JSON with 44 items', async () => {
    const request = new Request('https://worker.local/api/universities');
    const response = await worker.fetch(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = (await response.json()) as { count: number; universities: any[] };
    expect(data.count).toBe(44);
    expect(data.universities).toHaveLength(44);
  });

  it('handles GET /api/jobs and returns JSON data with verifiedCount and rejectedCount', async () => {
    const request = new Request('https://worker.local/api/jobs');
    const response = await worker.fetch(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = (await response.json()) as {
      count: number;
      verifiedCount: number;
      rejectedCount: number;
      positions: any[];
    };
    expect(typeof data.count).toBe('number');
    expect(data.verifiedCount).toBeGreaterThanOrEqual(15);
    expect(data.rejectedCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.positions)).toBe(true);
  });
});
