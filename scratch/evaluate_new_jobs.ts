import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { JOBS_GOTTINGEN_DATA } from '../src/jobs-gottingen-data';

interface RawInputJob {
  source: string;
  referenznummer?: string;
  id?: string;
  title: string;
  employer: string;
  location: string;
  isHomeOffice?: boolean;
  isRemote?: boolean;
  jobUrl: string;
  applicationLink?: string;
  descriptionHtml?: string;
}

interface NormalizedJob {
  jobId: string;
  source: string;
  title: string;
  employer: string;
  location: string;
  isRemote: boolean;
  directUrl: string;
  rawDescription: string;
}

interface EvaluatedResult {
  jobId: string;
  isMatch: boolean;
  rejectionReason?: string;
  jobTitle: string;
  employer: string;
  workplaceLocation: string;
  category: string;
  fitAssessment: string;
  directApplicationLink: string;
}

// 1. Get GEMINI_API_KEY
let apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && fs.existsSync('.dev.vars')) {
  const content = fs.readFileSync('.dev.vars', 'utf-8');
  const match = content.match(/GEMINI_API_KEY=([^\s]+)/);
  if (match) apiKey = match[1];
}

if (!apiKey) {
  console.error('GEMINI_API_KEY is not defined');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const evaluationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      jobId: { type: Type.STRING },
      isMatch: {
        type: Type.BOOLEAN,
        description: 'True if suitable for English-speaking female graduate (BSc International Relations, MSc Industrial Relations & HRM) with ZERO German required.',
      },
      rejectionReason: {
        type: Type.STRING,
        description: 'If rejected, concise reason (e.g., German required B2/C1, pure software engineering, physical labor, nurse, driver).',
      },
      jobTitle: { type: Type.STRING },
      employer: { type: Type.STRING },
      workplaceLocation: {
        type: Type.STRING,
        description: 'Standardized location: either "Göttingen (Onsite/Hybrid)" or "Remote (Germany)".',
      },
      category: {
        type: Type.STRING,
        description: 'One of: "Customer Service & Client Operations", "Admin, HR & People Operations", "Sales, Marketing & Content", "Operations, Project & Account Mgmt".',
      },
      fitAssessment: {
        type: Type.STRING,
        description: 'A 2-3 sentence explanation in Simplified Technical English explaining role fit and language requirement (zero German).',
      },
      directApplicationLink: {
        type: Type.STRING,
        description: 'Clean direct application link.',
      },
    },
    required: ['jobId', 'isMatch', 'jobTitle', 'employer', 'workplaceLocation', 'category', 'fitAssessment', 'directApplicationLink'],
  },
};

const SYSTEM_INSTRUCTION = `
You are an expert Talent Acquisition Specialist evaluating job listings for an English-speaking female professional in Germany.

Candidate Background:
- BSc in International Relations
- MSc in Industrial Relations and Human Resource Management (HRM)
- Strong customer-facing experience (Customer Support, Client Operations, Onboarding, Hospitality/People Services)
- Fluent English. ZERO GERMAN (cannot speak German; German cannot be a mandatory requirement).

Strict Evaluation Rules:
1. LANGUAGE:
   - Must be 100% English working environment.
   - REJECT if German is mandatory, required, or expected (e.g. "sehr gute Deutschkenntnisse", "fluent German", "B2/C1", "German is required").
   - ACCEPT if German is only "nice to have", "an advantage", "a plus", or if English is the primary working language.
2. LOCATION:
   - Göttingen (onsite, hybrid, or within 25km) OR 100% Remote within Germany.
   - Standardize location to either "Göttingen (Onsite/Hybrid)" or "Remote (Germany)".
3. RELEVANCE / FIELD:
   - MATCH roles in: Customer Service, Client Operations, Customer Success, HR / People Ops, Recruiting, General Administration, Office / Project Coordination, Account Management, Inside Sales, Community Management.
   - REJECT roles in: Pure software engineering / coding / devops, physical driving / logistics labor, nurses / medical healthcare, manual manufacturing, senior executive VP roles requiring 10+ years experience.
4. TONE:
   - Write fitAssessment strictly in clear Simplified Technical English.
`.trim();

async function evaluateBatch(batch: NormalizedJob[]): Promise<EvaluatedResult[]> {
  const prompt = `Evaluate the following ${batch.length} job postings:\n\n` + JSON.stringify(batch, null, 2);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: evaluationSchema,
        temperature: 0.1,
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as EvaluatedResult[];
    }
    return [];
  } catch (err) {
    console.error('Gemini batch evaluation error:', err);
    return [];
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== Starting Gemini Evaluation for New Arbeitsagentur & Xing Jobs ===');

  const rawJobs: NormalizedJob[] = [];
  const existingTitles = new Set(JOBS_GOTTINGEN_DATA.map((j) => `${j.employer.toLowerCase()}:::${j.jobTitle.toLowerCase()}`));

  // 1. Load Arbeitsagentur
  const aaPath = path.join(process.cwd(), 'scratch', 'arbeitsagentur_raw_jobs.json');
  if (fs.existsSync(aaPath)) {
    const aaJobs = JSON.parse(fs.readFileSync(aaPath, 'utf-8')) as RawInputJob[];
    console.log(`Loaded ${aaJobs.length} raw jobs from Arbeitsagentur.`);
    for (const j of aaJobs) {
      const key = `${j.employer.toLowerCase()}:::${j.title.toLowerCase()}`;
      if (existingTitles.has(key)) continue;

      const isRemote = j.isHomeOffice || j.isRemote || j.location.toLowerCase().includes('remote');
      const desc = j.descriptionHtml || j.title;

      rawJobs.push({
        jobId: `aa-${j.referenznummer || Math.random().toString(36).slice(2, 9)}`,
        source: 'arbeitsagentur',
        title: j.title,
        employer: j.employer,
        location: isRemote ? 'Remote (Germany)' : 'Göttingen (Onsite/Hybrid)',
        isRemote: Boolean(isRemote),
        directUrl: j.applicationLink || j.jobUrl,
        rawDescription: desc.slice(0, 2500),
      });
    }
  }

  // 2. Load Xing
  const xingPath = path.join(process.cwd(), 'scratch', 'xing_raw_jobs.json');
  if (fs.existsSync(xingPath)) {
    const xingJobs = JSON.parse(fs.readFileSync(xingPath, 'utf-8')) as RawInputJob[];
    console.log(`Loaded ${xingJobs.length} raw jobs from Xing.`);
    for (const j of xingJobs) {
      const key = `${j.employer.toLowerCase()}:::${j.title.toLowerCase()}`;
      if (existingTitles.has(key)) continue;

      const isRemote = j.isRemote || j.location.toLowerCase().includes('remote');
      const desc = j.descriptionHtml || j.title;

      rawJobs.push({
        jobId: `xing-${j.id || Math.random().toString(36).slice(2, 9)}`,
        source: 'xing',
        title: j.title,
        employer: j.employer,
        location: isRemote ? 'Remote (Germany)' : 'Göttingen (Onsite/Hybrid)',
        isRemote: Boolean(isRemote),
        directUrl: j.applicationLink || j.jobUrl,
        rawDescription: desc.slice(0, 2500),
      });
    }
  }

  console.log(`\nTotal new candidates to evaluate (after deduplication): ${rawJobs.length}`);

  const BATCH_SIZE = 15;
  const verifiedMatches: EvaluatedResult[] = [];
  const rejectedMatches: EvaluatedResult[] = [];

  for (let i = 0; i < rawJobs.length; i += BATCH_SIZE) {
    const batch = rawJobs.slice(i, i + BATCH_SIZE);
    console.log(`Evaluating batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(rawJobs.length / BATCH_SIZE)} (${batch.length} jobs)...`);
    const results = await evaluateBatch(batch);

    for (const r of results) {
      if (r.isMatch) {
        verifiedMatches.push(r);
        console.log(`  [MATCH] ${r.jobTitle} @ ${r.employer} (${r.workplaceLocation})`);
      } else {
        rejectedMatches.push(r);
      }
    }

    await sleep(400);
  }

  console.log(`\n=== Evaluation Complete ===`);
  console.log(`Total Verified Matches: ${verifiedMatches.length}`);
  console.log(`Total Rejected: ${rejectedMatches.length}`);

  const outResultPath = path.join(process.cwd(), 'scratch', 'new_evaluated_matches.json');
  fs.writeFileSync(outResultPath, JSON.stringify({ verifiedMatches, rejectedMatches }, null, 2), 'utf-8');
  console.log(`Saved evaluation results to ${outResultPath}`);
}

main().catch((err) => {
  console.error('Fatal evaluation error:', err);
  process.exit(1);
});

