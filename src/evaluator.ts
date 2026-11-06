import { GoogleGenAI } from '@google/genai';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { parse } from 'node-html-parser';
import * as z from 'zod';
import { PhDPosition, UniversityEntry } from './types';
import { getEvaluationFromDb, saveEvaluation } from './db';
import { getCachedEvaluationFromRedis, setCachedEvaluationInRedis } from './redis';
import { classifyCandidateState, resolveVerdictState } from './evaluation-state-machine';

export interface DetailPageData {
  markdown: string;
  isGone: boolean;
}

const GEMINI_MODEL = 'gemini-3.8-flash';

export const evaluationJsonSchema: Parameters<typeof z.fromJSONSchema>[0] & Record<string, unknown> = {
  type: 'object',
  properties: {
    evaluations: {
      type: 'array',
      description: 'List of evaluated and English-translated PhD positions extracted from the job page markdown.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The exact ID of the job listing from the input.',
          },
          englishTitle: {
            type: 'string',
            description: 'The job title translated into clear English.',
          },
          englishEmployer: {
            type: 'string',
            description: 'The university or employer name translated into clear English.',
          },
          englishLocation: {
            type: 'string',
            description: 'The city or region name extracted from the listing and translated into English.',
          },
          applicationWindow: {
            type: 'string',
            description:
              'The application window or intake period extracted from the listing in English (for example, "October – 31 January", "Open now", or "Rolling / Year-round").',
          },
          englishDeadline: {
            type: 'string',
            description: 'The application deadline extracted from the listing and translated into English.',
          },
          state: {
            type: 'string',
            description: 'The German federal state where the institution is located.',
          },
          isWestGermany: {
            type: 'boolean',
            description:
              'True if located in Western Germany (Baden-Württemberg, Bavaria, Bremen, Hamburg, Hesse, Lower Saxony, North Rhine-Westphalia, Rhineland-Palatinate, Saarland, Schleswig-Holstein); false if in former DDR states or Berlin.',
          },
          isEnglishPreferred: {
            type: 'boolean',
            description:
              'True only if the doctoral work can be completed in English without requiring German. If the listing states "fluent in English and German" or requires both languages, this must be false.',
          },
          matchedKeywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Relevant English academic keywords for the position.',
          },
          verificationStatus: {
            type: 'string',
            enum: ['Verified Match', 'Conditional Match', 'Rejected'],
            description:
              'Verification status against the applicant profile. Must be "Rejected" if German proficiency is required (including "fluent in English and German"), if located outside Western Germany, or if the role is not a PhD position in a matching field.',
          },
          matchScore: {
            type: 'integer',
            description: 'Compatibility score from 0 to 100.',
          },
          degreeFit: {
            type: 'string',
            description:
              'One short sentence in ASD-STE100 Simplified Technical English explaining degree compatibility.',
          },
          languageRequirement: {
            type: 'string',
            description:
              'One short sentence in ASD-STE100 Simplified Technical English stating the language requirement.',
          },
          compensation: {
            type: 'string',
            description:
              'One short sentence in ASD-STE100 Simplified Technical English stating salary or funding terms.',
          },
          aiSummary: {
            type: 'string',
            description:
              'One short sentence in ASD-STE100 Simplified Technical English summarizing why the listing matches or is rejected.',
          },
        },
        required: [
          'id',
          'englishTitle',
          'englishEmployer',
          'englishLocation',
          'applicationWindow',
          'englishDeadline',
          'state',
          'isWestGermany',
          'isEnglishPreferred',
          'matchedKeywords',
          'verificationStatus',
          'matchScore',
          'degreeFit',
          'languageRequirement',
          'compensation',
          'aiSummary',
        ],
      },
    },
  },
  required: ['evaluations'],
};

export const evaluationSchema = z.fromJSONSchema(evaluationJsonSchema);

export interface GeminiVerdict {
  id: string;
  englishTitle: string;
  englishEmployer: string;
  englishLocation: string;
  applicationWindow: string;
  englishDeadline: string;
  state: string;
  isWestGermany: boolean;
  isEnglishPreferred: boolean;
  matchedKeywords: string[];
  verificationStatus: 'Verified Match' | 'Conditional Match' | 'Rejected';
  matchScore: number;
  degreeFit: string;
  languageRequirement: string;
  compensation: string;
  aiSummary: string;
}

// Cache evaluated listings so repeat scans do not re-bill unchanged listing URLs
const evaluationCache = new Map<string, Partial<PhDPosition>>();

/**
 * Fetch the full detail page of a job listing and convert its HTML to Markdown.
 */
export async function fetchListingDetail(url: string): Promise<DetailPageData> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PhD-Finder/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 404 || res.status === 410) {
      return { markdown: '', isGone: true };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const buffer = await res.arrayBuffer();
    const html =
      contentType.includes('iso-8859-1') || contentType.includes('latin1')
        ? new TextDecoder('iso-8859-1').decode(buffer)
        : new TextDecoder('utf-8').decode(buffer);

    const root = parse(html);
    root.querySelectorAll('script, style, nav, header, footer, svg, noscript').forEach((el) => el.remove());
    const mainEl = root.querySelector('main') || root.querySelector('#main, #content') || root;

    const markdown = NodeHtmlMarkdown.translate(mainEl.toString());
    return {
      markdown: markdown.slice(0, 8000),
      isGone: false,
    };
  } catch (error) {
    console.error(`Failed to fetch detail page (${url}):`, error);
    return { markdown: '', isGone: false };
  }
}

/**
 * Use the official @google/genai SDK (gemini-3.8-flash) with structured output schema and Zod validation
 * to extract all job details, translate German text to English, and evaluate candidate listings from Markdown.
 */
export async function evaluateCandidatesWithGemini(
  positions: PhDPosition[],
  detailMarkdowns: Map<string, DetailPageData>,
  apiKey?: string
): Promise<PhDPosition[]> {
  const resolvedKey = apiKey || process.env.GEMINI_API_KEY;
  const results: PhDPosition[] = [];
  const toEvaluate: { pos: PhDPosition; markdown: string }[] = [];

  // Phase 1: Classify positions through explicit state machine
  for (const pos of positions) {
    const detail = detailMarkdowns.get(pos.id);

    // Retrieve cached evaluation (Memory -> Redis -> SQLite)
    let cached = evaluationCache.get(pos.id);
    if (!cached) {
      const redisCached = await getCachedEvaluationFromRedis(pos.id);
      if (redisCached) {
        cached = redisCached;
        evaluationCache.set(pos.id, cached);
      }
    }
    if (!cached) {
      const dbCached = getEvaluationFromDb(pos.id);
      if (dbCached) {
        cached = dbCached;
        evaluationCache.set(pos.id, cached);
      }
    }

    const resolution = classifyCandidateState({
      pos,
      detail,
      cached,
      hasApiKey: Boolean(resolvedKey),
    });

    if (resolution.finalPosition) {
      results.push(resolution.finalPosition);
    } else if (resolution.candidateToEvaluate) {
      toEvaluate.push(resolution.candidateToEvaluate);
    }
  }

  if (!resolvedKey || toEvaluate.length === 0) {
    return results;
  }

  try {
    const client = new GoogleGenAI({ apiKey: resolvedKey });
    const systemPrompt = `You are an academic admissions verifier. Evaluate each German job listing against this applicant's exact profile:
- Degrees held: BSc in International Relations + Professional Master's in Industrial Relations and Human Resource Management (HRM) from Nigeria.
- Language: Speaks English ONLY. Speaks ZERO German. Reject any job that requires German proficiency (C1/C2 German or "sehr gute Deutschkenntnisse").
- Goal: Paid PhD / Doctoral researcher position in Western Germany (non-DDR). Reject Postdoc-only, Professorship, or unrelated STEM/Law/Tax/Elementary Education roles.`;

    const batchSize = 10;
    const batches: (typeof toEvaluate)[] = [];
    for (let i = 0; i < toEvaluate.length; i += batchSize) {
      batches.push(toEvaluate.slice(i, i + batchSize));
    }

    const verdictMap = new Map<string, GeminiVerdict>();
    await Promise.all(
      batches.map(async (batch) => {
        const promptItems = batch.map((item) => ({
          id: item.pos.id,
          title: item.pos.title,
          employer: item.pos.employer,
          location: item.pos.location,
          publicationDate: item.pos.publicationDate,
          applicationWindow: item.pos.applicationWindow,
          deadline: item.pos.deadline,
          state: item.pos.state,
          pageMarkdown: item.markdown.slice(0, 6000),
        }));

        const prompt = `${systemPrompt}\n\n${JSON.stringify(promptItems)}`;
        const interaction = await client.interactions.create({
          model: GEMINI_MODEL,
          input: prompt,
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: evaluationJsonSchema,
          },
        });

        if (interaction.output_text) {
          const parsed = evaluationSchema.parse(JSON.parse(interaction.output_text)) as {
            evaluations: GeminiVerdict[];
          };
          for (const v of parsed.evaluations) {
            if (v && v.id) {
              verdictMap.set(v.id, v);
            }
          }
        }
      })
    );

    if (verdictMap.size > 0) {
      for (const item of toEvaluate) {
        const v = verdictMap.get(item.pos.id);
        const resolved = resolveVerdictState(item.pos, v);
        if (v) {
          evaluationCache.set(item.pos.id, resolved);
          saveEvaluation(item.pos.id, resolved);
          setCachedEvaluationInRedis(item.pos.id, resolved).catch(() => {});
        }
        results.push(resolved);
      }
      return results;
    }
  } catch (error) {
    console.error('Gemini SDK evaluation error:', error);
  }

  // Phase 3: Transition unevaluated candidates to Unverified state
  for (const item of toEvaluate) {
    results.push(resolveVerdictState(item.pos, undefined));
  }
  return results;
}

/**
 * Convert all 44 verified English Doctoral Programs and Graduate Schools in Western Germany
 * from UNIVERSITIES_DATA into ready-to-apply PhD opportunities.
 */
export function buildStructuredProgramPositions(universities: UniversityEntry[]): PhDPosition[] {
  return universities.map((u) => {
    // Select the best direct application/admission URL over general homepages
    const appKeywords = ['application', 'apply', 'admission', 'guidelines', 'requirements', 'cfa', 'dossier', 'enrolling'];
    const bestUrlEntry =
      u.urls.find((item) => appKeywords.some((k) => item.label.toLowerCase().includes(k) || item.url.toLowerCase().includes(k))) ||
      u.urls[0];

    const primaryUrl = bestUrlEntry?.url || u.urls[0]?.url || 'https://www2.daad.de';
    const profLinks = u.urls
      .slice(1)
      .map((l) => l.label)
      .join(', ');

    const isStructured = u.pathway.includes('Structured');

    return {
      id: `structured-phd-${u.id}`,
      title: `${u.program} — ${isStructured ? 'Structured English PhD Program' : 'Verified English PhD Course & Chair'}`,
      employer: u.name,
      location: u.location,
      state: u.state,
      isWestGermany: true,
      publicationDate: 'Academic Year Intake',
      applicationWindow: u.applicationWindow || 'October – March (Intake Period)',
      deadline: u.deadline || '31 January / 31 March (Annual Cohort)',
      link: primaryUrl,
      matchedKeywords: u.fields.map((f) => f.toLowerCase()),
      isEnglishPreferred: true,
      description: `${u.program} at ${u.name}. ${u.verifiedProfessorsSummary}`,
      source: 'Verified English PhD Program',
      opportunityType: 'Structured PhD Program',
      verificationStatus: 'Verified Match',
      matchScore: 96,
      degreeFit: `Accepts Master in ${u.fields.join(', ')}.`,
      languageRequirement: `100% English curriculum and dissertation (${u.languagePolicy}). No German required.`,
      compensation: u.funding,
      aiSummary: `Verified English PhD Opportunity: ${u.program}. Key Chairs: ${u.verifiedProfessorsSummary}${profLinks ? ` (${profLinks})` : ''}`,
      evaluatedBy: 'Rule Engine',
    };
  });
}
