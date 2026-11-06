import { parse } from 'node-html-parser';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { PhDPosition } from './types';
import { parseRssFeed } from './parser';
import { identifyGermanRegion } from './geo';
import { matchJobKeywords } from './filters';
import { UNIVERSITIES_DATA } from './universities-data';
import {
  DetailPageData,
  fetchListingDetail,
  evaluateCandidatesWithGemini,
  buildStructuredProgramPositions,
} from './evaluator';

const BUND_FEED_URL = 'https://www.service.bund.de/Content/Globals/Functions/RSSFeed/RSSGenerator_Stellen.xml';

const BUND_SEARCH_QUERIES = [
  'Soziologie',
  'Politikwissenschaft',
  'Doktorand',
  'Promotion',
];

const MYSCIENCE_FEEDS = [
  'https://www.myscience.de/jobs?d=Social%20Sciences&mode=rss',
  'https://www.myscience.de/jobs?d=Economics&mode=rss',
  'https://www.myscience.de/jobs?d=Politics&mode=rss',
  'https://www.myscience.de/jobs/rss',
];

// EURAXESS Germany (794) + R1 First Stage Researcher / PhD (447) in Economics (117), Management (3485), Political Science (367), Sociology (388)
const EURAXESS_FIELD_URLS = [
  { fieldId: '117', label: 'economics' },
  { fieldId: '3485', label: 'management / business' },
  { fieldId: '367', label: 'political science' },
  { fieldId: '388', label: 'sociology' },
].map((f) => ({
  url: `https://euraxess.ec.europa.eu/jobs/search?f%5B0%5D=job_country%3A794&f%5B1%5D=job_research_profile%3A447&f%5B2%5D=job_research_field%3A${f.fieldId}`,
  label: f.label,
}));

// Cache detail page fetches in memory so repeat scans do not re-download unchanged job pages
const detailPageCache = new Map<string, DetailPageData>();

/**
 * Decode response text respecting ISO-8859-1 / Latin-1 headers (used by myScience.de).
 */
async function decodeResponseText(res: Response): Promise<string> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const buffer = await res.arrayBuffer();
  if (contentType.includes('iso-8859-1') || contentType.includes('latin1')) {
    return new TextDecoder('iso-8859-1').decode(buffer);
  }
  return new TextDecoder('utf-8').decode(buffer);
}

/**
 * Scan EURAXESS, myScience.de, and service.bund.de, convert detail pages to Markdown,
 * and evaluate with Gemini AI to return verified, ready-to-apply PhD positions.
 */
export async function scanFeeds(apiKey?: string): Promise<PhDPosition[]> {
  const rawCandidates: PhDPosition[] = [];
  const seenIds = new Set<string>();

  const addCandidate = (dedupKey: string, pos: PhDPosition) => {
    const normalizedKey = dedupKey.toLowerCase().trim();
    if (!seenIds.has(normalizedKey)) {
      seenIds.add(normalizedKey);
      rawCandidates.push(pos);
    }
  };

  // Stage 1: Fetch all feeds and search pages in parallel
  const euraxessPromises = EURAXESS_FIELD_URLS.map(async ({ url, label }) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PhD-Finder/1.0' },
      });
      if (!res.ok) return;
      const html = await res.text();
      const root = parse(html);

      for (const card of root.querySelectorAll('article.ecl-content-item')) {
        const titleAnchor = card.querySelector('h3.ecl-content-block__title a');
        if (!titleAnchor) continue;

        const relLink = (titleAnchor.getAttribute('href') || '').trim();
        if (!relLink) continue;
        const link = relLink.startsWith('http') ? relLink : `https://euraxess.ec.europa.eu${relLink}`;
        const title = titleAnchor.text.trim();

        const orgAnchor = card.querySelector('li.ecl-content-block__primary-meta-item a');
        const employer = orgAnchor ? orgAnchor.text.trim() : 'German Research University';

        const metaItems = card.querySelectorAll('li.ecl-content-block__primary-meta-item');
        const postedItem = metaItems.find((el) => el.text.includes('Posted on:'));
        const pubDate = postedItem ? postedItem.text.replace('Posted on:', '').trim() : '';

        const descBlock = card.querySelector('div.ecl-content-block__description');
        const desc = descBlock ? NodeHtmlMarkdown.translate(descBlock.innerHTML).trim() : title;

        const geo = identifyGermanRegion(`${employer} ${title} ${desc}`);
        if (geo.state === 'Outside Germany') continue;

        const filterRes = matchJobKeywords(title, `${employer} ${desc} ${label} phd doctoral`);
        if (filterRes.isMatch) {
          addCandidate(link, {
            id: link,
            title,
            employer,
            location: geo.city || geo.state,
            postalCode: geo.postalCode,
            state: geo.state,
            isWestGermany: geo.isWestGermany,
            publicationDate: pubDate,
            deadline: '',
            link,
            matchedKeywords: filterRes.matchedKeywords,
            isEnglishPreferred: true,
            description: desc,
            source: 'EURAXESS Germany',
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching EURAXESS field (${label}):`, error);
    }
  });

  const mySciencePromises = MYSCIENCE_FEEDS.map(async (feedUrl) => {
    try {
      const sciRes = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PhD-Finder/1.0',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });
      if (!sciRes.ok) return;

      const xml = await decodeResponseText(sciRes);
      const rawItems = parseRssFeed(xml);

      for (const item of rawItems) {
        const dashIdx = item.title.indexOf(' - ');
        const cleanTitle = dashIdx > 0 && dashIdx <= 15 ? item.title.slice(dashIdx + 3).trim() : item.title.trim();
        const extractedDate = dashIdx > 0 && dashIdx <= 15 ? item.title.slice(0, dashIdx).trim() : item.pubDate;

        const descMarkdown = NodeHtmlMarkdown.translate(item.description).trim();
        const parts = descMarkdown.split(' - ').filter(Boolean);
        const employer = (parts[0] || 'German University').trim();
        const subjects = parts.slice(1).join(', ');

        const geo = identifyGermanRegion(`${employer} ${cleanTitle}`);
        if (geo.state === 'Outside Germany') continue;

        const filterRes = matchJobKeywords(cleanTitle, `${employer} ${subjects}`);
        if (filterRes.isMatch) {
          addCandidate(item.link, {
            id: item.guid || item.link,
            title: cleanTitle,
            employer,
            location: geo.city || geo.state,
            postalCode: geo.postalCode,
            state: geo.state,
            isWestGermany: geo.isWestGermany,
            publicationDate: extractedDate,
            deadline: '',
            link: item.link,
            matchedKeywords: filterRes.matchedKeywords,
            isEnglishPreferred: filterRes.isEnglishPreferred,
            description: descMarkdown,
            source: 'myScience.de',
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching myScience feed (${feedUrl}):`, error);
    }
  });

  const bundSearchPromises = BUND_SEARCH_QUERIES.map(async (query) => {
    try {
      const searchUrl = `https://www.service.bund.de/Content/DE/Stellen/Suche/Formular.html?nn=4641496&type=0&submit=Finden&resultsPerPage=50&templateQueryString=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PhD-Finder/1.0' },
      });
      if (!res.ok) return;

      const html = await res.text();
      const root = parse(html);

      for (const anchor of root.querySelectorAll('a')) {
        const href = anchor.getAttribute('href') || '';
        if (!href.startsWith('IMPORTE/Stellenangebote/')) continue;

        const relativePath = href.split(';')[0].split('?')[0];
        const link = `https://www.service.bund.de/${relativePath}`;

        const h3 = anchor.querySelector('h3');
        h3?.querySelector('em')?.remove();
        const title = h3 ? h3.text.trim() : '';
        if (!title) continue;

        const paragraphs = anchor.querySelectorAll('p');
        let employer = 'German Public Institution';
        let pubDate = '';
        let deadline = '';

        for (const p of paragraphs) {
          const labelEl = p.querySelector('em');
          const labelText = labelEl ? labelEl.text.trim() : '';
          labelEl?.remove();
          const val = p.text.trim();
          if (labelText.includes('Arbeitgeber')) employer = val;
          else if (labelText.includes('Veröffentlicht')) pubDate = val;
          else if (labelText.includes('Bewerbungsfrist')) deadline = val;
        }

        const geo = identifyGermanRegion(`${employer} ${title}`);
        if (geo.state === 'Outside Germany') continue;

        const filterRes = matchJobKeywords(title, `${employer} ${query}`);
        if (filterRes.isMatch) {
          addCandidate(`${title}::${employer}`, {
            id: link,
            title,
            employer,
            location: geo.city || geo.state,
            postalCode: geo.postalCode,
            state: geo.state,
            isWestGermany: geo.isWestGermany,
            publicationDate: pubDate,
            deadline,
            link,
            matchedKeywords: filterRes.matchedKeywords,
            isEnglishPreferred: filterRes.isEnglishPreferred,
            description: `${title} — ${employer}`,
            source: 'service.bund.de',
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching service.bund.de query (${query}):`, error);
    }
  });

  const bundRssPromise = (async () => {
    try {
      const bundRes = await fetch(BUND_FEED_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PhD-Finder/1.0',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });
      if (!bundRes.ok) return;

      const xml = await bundRes.text();
      const rawItems = parseRssFeed(xml);

      for (const item of rawItems) {
        const descMarkdown = NodeHtmlMarkdown.translate(item.description).trim();
        const cleanTitle = item.title.trim();
        const geo = identifyGermanRegion(`${descMarkdown} ${cleanTitle}`);
        if (geo.state === 'Outside Germany') continue;

        const filterRes = matchJobKeywords(cleanTitle, descMarkdown);
        if (filterRes.isMatch) {
          addCandidate(`${cleanTitle}::${item.link}`, {
            id: item.guid || item.link,
            title: cleanTitle,
            employer: 'German Public Institution',
            location: geo.city || geo.state,
            postalCode: geo.postalCode,
            state: geo.state,
            isWestGermany: geo.isWestGermany,
            publicationDate: item.pubDate,
            deadline: '',
            link: item.link,
            matchedKeywords: filterRes.matchedKeywords,
            isEnglishPreferred: filterRes.isEnglishPreferred,
            description: descMarkdown,
            source: 'service.bund.de',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching service.bund.de RSS feed:', error);
    }
  })();

  await Promise.allSettled([...euraxessPromises, ...mySciencePromises, ...bundSearchPromises, bundRssPromise]);

  // Stage 2: Fetch detail pages and convert HTML to Markdown for West German candidates
  const detailMarkdownMap = new Map<string, DetailPageData>();
  const toFetchDetails = rawCandidates.filter((pos) => pos.isWestGermany);

  await Promise.allSettled(
    toFetchDetails.map(async (pos) => {
      let detail = detailPageCache.get(pos.link);
      if (!detail) {
        detail = await fetchListingDetail(pos.link);
        detailPageCache.set(pos.link, detail);
      }
      detailMarkdownMap.set(pos.id, detail);
    })
  );

  // Stage 3: Gemini AI Extraction, Translation, and Verification from Markdown
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY;
  const verifiedLivePositions = await evaluateCandidatesWithGemini(
    rawCandidates,
    detailMarkdownMap,
    effectiveKey
  );

  // Add all 44 Verified English PhD Programs and Courses in Western Germany
  const structuredPrograms = buildStructuredProgramPositions(UNIVERSITIES_DATA);

  const allEvaluated = [...verifiedLivePositions, ...structuredPrograms];

  // Sort: Verified Match first, Live Vacancies before Structured Programs, then by highest matchScore
  allEvaluated.sort((a, b) => {
    const statusOrder = (s?: string) => (s === 'Verified Match' ? 0 : s === 'Conditional Match' ? 1 : 2);
    const diff = statusOrder(a.verificationStatus) - statusOrder(b.verificationStatus);
    if (diff !== 0) return diff;
    const typeOrder = (t?: string) => (t === 'Live Vacancy' ? 0 : 1);
    const typeDiff = typeOrder(a.opportunityType) - typeOrder(b.opportunityType);
    if (typeDiff !== 0) return typeDiff;
    return (b.matchScore || 0) - (a.matchScore || 0);
  });

  return allEvaluated;
}
