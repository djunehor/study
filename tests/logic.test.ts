import { describe, it, expect } from 'vitest';
import { identifyGermanRegion } from '../src/geo';
import { matchJobKeywords } from '../src/filters';
import { parseRssFeed, stripHtml } from '../src/parser';
import { generateExcelCsv, generateUniversitiesCsv } from '../src/exporter';
import { PhDPosition } from '../src/types';
import { UNIVERSITIES_DATA } from '../src/universities-data';
import { scanFeeds } from '../src/scanner';
import {
  evaluateCandidatesWithGemini,
  buildStructuredProgramPositions,
  evaluationSchema,
} from '../src/evaluator';

describe('Geo Region Identification', () => {
  it('correctly classifies West German postal codes', () => {
    const nrw = identifyGermanRegion('50667 Köln');
    expect(nrw.isWestGermany).toBe(true);
    expect(nrw.state).toBe('Nordrhein-Westfalen');

    const bayern = identifyGermanRegion('80331 München');
    expect(bayern.isWestGermany).toBe(true);
    expect(bayern.state).toBe('Bayern');

    const hessen = identifyGermanRegion('60311 Frankfurt am Main');
    expect(hessen.isWestGermany).toBe(true);
    expect(hessen.state).toBe('Hessen');
  });

  it('correctly classifies Former DDR postal codes', () => {
    const sachsen = identifyGermanRegion('01067 Dresden');
    expect(sachsen.isWestGermany).toBe(false);
    expect(sachsen.state).toBe('Sachsen');

    const thueringen = identifyGermanRegion('99084 Erfurt');
    expect(thueringen.isWestGermany).toBe(false);
    expect(thueringen.state).toBe('Thüringen');

    const brandenburg = identifyGermanRegion('14467 Potsdam');
    expect(brandenburg.isWestGermany).toBe(false);
    expect(brandenburg.state).toBe('Brandenburg');

    const berlin = identifyGermanRegion('10115 Berlin');
    expect(berlin.isWestGermany).toBe(false);
    expect(berlin.state).toBe('Berlin');
  });

  it('correctly identifies regions from city text without postal codes', () => {
    const bonn = identifyGermanRegion('Universität Bonn');
    expect(bonn.isWestGermany).toBe(true);
    expect(bonn.state).toBe('Nordrhein-Westfalen');

    const leipzig = identifyGermanRegion('Universität Leipzig');
    expect(leipzig.isWestGermany).toBe(false);
    expect(leipzig.state).toBe('Sachsen');
  });
});

describe('Keyword and PhD Matching', () => {
  it('identifies relevant PhD positions in Industrial Relations and HR', () => {
    const title = 'Wissenschaftlicher Mitarbeiter (m/w/d) Industrial Relations and Human Resource Management';
    const desc = 'TV-L E13 position for doctoral candidate in comparative labor relations.';
    const result = matchJobKeywords(title, desc);

    expect(result.isMatch).toBe(true);
    expect(result.isAcademicOrPaid).toBe(true);
    expect(result.matchedKeywords).toContain('industrial relations');
    expect(result.matchedKeywords).toContain('human resource');
    expect(result.isEnglishPreferred).toBe(true);
  });

  it('rejects irrelevant non-academic postings', () => {
    const title = 'Sachbearbeiter Buchhaltung (m/w/d)';
    const desc = 'Kaufmännische Angestellte für Rechnungswesen.';
    const result = matchJobKeywords(title, desc);

    expect(result.isMatch).toBe(false);
    expect(result.isAcademicOrPaid).toBe(false);
  });
});

describe('Markdown & Gemini Evaluator', () => {
  const basePosition: PhDPosition = {
    id: 'test-1',
    title: 'Doktorand*in (w/m/d)',
    employer: 'Georg-August-Universität Göttingen',
    location: 'Göttingen',
    state: 'Niedersachsen',
    isWestGermany: true,
    publicationDate: '2 Nov 2026',
    deadline: '15.12.2026',
    link: 'https://example.com/job',
    matchedKeywords: ['political science'],
    isEnglishPreferred: false,
    description: 'Georg-August-Universität Göttingen - Politics',
    source: 'myScience.de',
  };

  it('rejects listings where detail page returned HTTP 404/410 Gone', async () => {
    const detailMap = new Map([
      ['test-1', { markdown: '', isGone: true }],
    ]);
    const [evaluated] = await evaluateCandidatesWithGemini([basePosition], detailMap);
    expect(evaluated.verificationStatus).toBe('Rejected');
    expect(evaluated.aiSummary).toContain('expired');
  });

  it('builds 44 verified Western Germany PhD program entries including Göttingen', () => {
    const programs = buildStructuredProgramPositions(UNIVERSITIES_DATA);
    expect(programs).toHaveLength(44);
    expect(programs.every((p) => p.verificationStatus === 'Verified Match')).toBe(true);
    expect(programs.every((p) => p.opportunityType === 'Structured PhD Program')).toBe(true);
    expect(programs.every((p) => Boolean(p.applicationWindow && p.deadline))).toBe(true);
    const gottingen = programs.find((p) => p.employer.includes('Göttingen'));
    expect(gottingen).toBeDefined();
    expect(gottingen?.title).toContain('Göttingen Graduate School of Social Sciences');
    expect(gottingen?.state).toBe('Niedersachsen');
  });

  it('validates structured Gemini JSON response schema with Zod', () => {
    const sampleJson = JSON.stringify({
      evaluations: [
        {
          id: 'job-1',
          englishTitle: 'Doctoral Researcher in Human Resource Management',
          englishEmployer: 'University of Goettingen',
          englishLocation: 'Goettingen',
          applicationWindow: '1 October – 15 December 2026',
          englishDeadline: '15 December 2026',
          state: 'Lower Saxony',
          isWestGermany: true,
          isEnglishPreferred: true,
          matchedKeywords: ['human resource', 'industrial relations'],
          verificationStatus: 'Verified Match',
          matchScore: 94,
          degreeFit: 'The listing accepts a Master degree in HRM and Industrial Relations.',
          languageRequirement: 'The position uses English as the working language.',
          compensation: 'The contract pays TV-L E13.',
          aiSummary: 'This paid doctoral position matches the applicant profile.',
        },
      ],
    });
    const parsed = evaluationSchema.parse(JSON.parse(sampleJson)) as {
      evaluations: { id: string; englishTitle: string; applicationWindow: string; englishDeadline: string }[];
    };
    expect(parsed.evaluations).toHaveLength(1);
    expect(parsed.evaluations[0].englishTitle).toBe(
      'Doctoral Researcher in Human Resource Management'
    );
    expect(parsed.evaluations[0].applicationWindow).toBe('1 October – 15 December 2026');
    expect(parsed.evaluations[0].englishDeadline).toBe('15 December 2026');
  });
});

describe('RSS Parser', () => {
  it('parses XML feed items and cleans CDATA', () => {
    const xmlSample = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Test Feed</title>
        <item>
          <title><![CDATA[PhD Researcher in Labor Relations]]></title>
          <link>https://example.com/job1</link>
          <description><![CDATA[Arbeitgeber: <strong>Uni Köln</strong><br />Ort: <strong>50667 Köln</strong>]]></description>
          <pubDate>Thu, 5 Nov 2026 12:00:00 +0100</pubDate>
          <guid>https://example.com/job1</guid>
        </item>
      </channel>
    </rss>`;

    const items = parseRssFeed(xmlSample);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('PhD Researcher in Labor Relations');
    expect(items[0].link).toBe('https://example.com/job1');
    expect(stripHtml(items[0].description)).toContain('Arbeitgeber: Uni Köln Ort: 50667 Köln');
  });
});

describe('Live Scanner Feeds Integration', () => {
  it('connects to live academic feeds, deep-inspects detail pages, and returns verified matches', async () => {
    const positions = await scanFeeds();
    expect(Array.isArray(positions)).toBe(true);
    expect(positions.length).toBeGreaterThanOrEqual(15);

    const verified = positions.filter((p) => p.verificationStatus === 'Verified Match');
    expect(verified.length).toBeGreaterThanOrEqual(15);

    const first = verified[0];
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('employer');
    expect(first).toHaveProperty('state');
    expect(first.isWestGermany).toBe(true);
    expect(first.link).toMatch(/^https?:\/\//);
    expect(first.verificationStatus).toBe('Verified Match');
  }, 45000);
});

describe('Excel CSV Exporter', () => {
  it('generates CSV with UTF-8 BOM and excludes Rejected listings', () => {
    const samplePositions: PhDPosition[] = [
      {
        id: '1',
        title: 'Doctoral Researcher in International Relations',
        employer: 'Universität Münster',
        location: '48149 Münster',
        postalCode: '48149',
        state: 'Nordrhein-Westfalen',
        isWestGermany: true,
        publicationDate: '2026-11-05',
        deadline: '2026-12-15',
        link: 'https://example.com/position/1',
        matchedKeywords: ['international relations', 'doctoral researcher'],
        isEnglishPreferred: true,
        description: 'Funded TV-L E13 position',
        source: 'service.bund.de',
        verificationStatus: 'Verified Match',
      },
      {
        id: '2',
        title: 'Wissenschaftlicher Mitarbeiter Bürgerliches Recht',
        employer: 'Universität Hannover',
        location: 'Hannover',
        state: 'Niedersachsen',
        isWestGermany: true,
        publicationDate: '2026-11-05',
        deadline: '2026-12-15',
        link: 'https://example.com/position/2',
        matchedKeywords: ['social sciences'],
        isEnglishPreferred: false,
        description: 'Requires German Law Exam',
        source: 'myScience.de',
        verificationStatus: 'Rejected',
      },
    ];

    const csv = generateExcelCsv(samplePositions);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Job ID,Title,Institution / Employer,Location');
    expect(csv).toContain('"Doctoral Researcher in International Relations"');
    expect(csv).toContain('"Universität Münster"');
    expect(csv).toContain('"West Germany (Non-DDR)"');
    expect(csv).toContain('"Yes"');
    expect(csv).not.toContain('"Wissenschaftlicher Mitarbeiter Bürgerliches Recht"');
  });

  it('generates 44 Universities directory CSV with UTF-8 BOM', () => {
    expect(UNIVERSITIES_DATA).toHaveLength(44);

    const csv = generateUniversitiesCsv(UNIVERSITIES_DATA);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('ID,Institution Name,Federal State,City / Region');
    expect(csv).toContain('"Max Planck Institute for the Study of Societies (MPIfG)"');
    expect(csv).toContain('"University of Siegen (NRW)"');
  });
});
