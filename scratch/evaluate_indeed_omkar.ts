import { GoogleGenAI, Type } from '@google/genai';
import * as fs from 'fs';

interface RawJobListing {
  jobId: string;
  id?: string;
  jobTitle: string;
  employer: string;
  location: string;
  directUrl: string;
  rawDescription: string;
}

interface EvaluatedJobResult {
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

// 2. Structured schema for Gemini
const jobEvaluationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      jobId: { type: Type.STRING },
      isMatch: {
        type: Type.BOOLEAN,
        description: 'True if this role is suitable for an English-speaking female graduate with zero/minimal German.'
      },
      rejectionReason: {
        type: Type.STRING,
        description: 'If rejected, short explanation why.'
      },
      jobTitle: { type: Type.STRING },
      employer: { type: Type.STRING },
      workplaceLocation: { type: Type.STRING },
      category: {
        type: Type.STRING,
        description: 'One of: Customer Care, Administration, Human Resources, Communications, Support & Training, Client Relations, Academic / Research, Operations'
      },
      fitAssessment: {
        type: Type.STRING,
        description: 'One concise sentence in ASD-STE100 Simplified Technical English explaining why it fits her.'
      },
      directApplicationLink: { type: Type.STRING }
    },
    required: ['jobId', 'isMatch', 'jobTitle', 'employer', 'workplaceLocation', 'category', 'fitAssessment', 'directApplicationLink']
  }
};

const evaluationPrompt = `You are a recruitment specialist evaluating job openings for an applicant in Göttingen, Germany.

Applicant Profile:
- Gender: Female.
- Language: Speaks fluent English. Speaks zero or minimal German.
- Education: University degrees (BSc in International Relations, Master's in Industrial Relations and Human Resource Management).
- Experience: Customer service, customer-facing roles, administrative coordination, communications.
- Permitted Workplace Locations:
  1. Göttingen (Onsite or Hybrid).
  2. 100% Remote within Germany with a German employer or contract.

Evaluation Criteria:
- ACCEPT:
  - Customer Care, Customer Success, Customer Service, Support Specialist, Client Relations.
  - Clerk, Administrative Assistant, Office Coordinator, Operations Specialist.
  - Human Resources, Talent Acquisition, People & Culture, Employee Relations, Onboarding.
  - Communications, Digital Marketing, Social Media Ambassador, Content Moderation.
  - Generalist project coordinator or academic administration suitable for an English speaker.
- REJECT:
  - Any job requiring fluent German (C1/C2 or where duties must be in German).
  - Delivery jobs requiring bicycle riding or physical parcel delivery.
  - Heavy physical trades, machining, warehouse labor, or craft work.
  - Pure software programming / DevOps / cloud architecture.
  - Wet-lab bench science (molecular biology, physics, biochemistry).
  - Jobs located outside Germany.

Evaluate the provided batch of jobs against this profile. Return the structured JSON array according to the response schema.`;

async function main() {
  // Load existing verified results
  let existingMatches: EvaluatedJobResult[] = [];
  if (fs.existsSync('scratch/gemini_structured_results.json')) {
    existingMatches = JSON.parse(fs.readFileSync('scratch/gemini_structured_results.json', 'utf-8'));
    console.log(`Loaded ${existingMatches.length} existing verified matches.`);
  }

  const seenKeys = new Set<string>();
  for (const m of existingMatches) {
    seenKeys.add(`${m.jobTitle.toLowerCase()}-${m.employer.toLowerCase()}`);
  }

  // Load scraped Indeed listings
  const indeedRaw: RawJobListing[] = JSON.parse(fs.readFileSync('scratch/indeed_omkar_jobs.json', 'utf-8'));
  console.log(`Loaded ${indeedRaw.length} raw Indeed listings from scratch/indeed_omkar_jobs.json`);

  const toEvaluate = indeedRaw.filter(
    (j) => !seenKeys.has(`${j.jobTitle.toLowerCase()}-${j.employer.toLowerCase()}`)
  );
  console.log(`New raw listings to evaluate with Gemini: ${toEvaluate.length}`);

  const batchSize = 10;
  const batches: RawJobListing[][] = [];
  for (let i = 0; i < toEvaluate.length; i += batchSize) {
    batches.push(toEvaluate.slice(i, i + batchSize));
  }

  console.log(`Sending ${batches.length} batches to Gemini (chunk concurrency = 5)...`);

  const concurrency = 5;
  const newMatches: EvaluatedJobResult[] = [];

  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (batch, chunkIdx) => {
        const batchNum = i + chunkIdx + 1;
        console.log(`Processing batch ${batchNum}/${batches.length}...`);

        let timer: any;
        const evalCall = async (): Promise<EvaluatedJobResult[]> => {
          try {
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `${evaluationPrompt}\n\nListings:\n${JSON.stringify(batch)}`,
              config: {
                responseMimeType: 'application/json',
                responseSchema: jobEvaluationSchema
              }
            });

            if (timer) clearTimeout(timer);
            if (response.text) {
              const parsed = JSON.parse(response.text) as EvaluatedJobResult[];
              const matches = parsed.filter((p) => p.isMatch);
              console.log(`Batch ${batchNum}/${batches.length} complete. Matches found: ${matches.length}`);
              return matches;
            }
          } catch (err) {
            console.error(`Error in Gemini batch ${batchNum}:`, err);
          }
          return [];
        };

        const timeout = new Promise<EvaluatedJobResult[]>((resolve) => {
          timer = setTimeout(() => {
            console.warn(`Batch ${batchNum}/${batches.length} timed out after 60s, continuing.`);
            resolve([]);
          }, 60000);
        });

        return await Promise.race([evalCall(), timeout]);
      })
    );
    newMatches.push(...chunkResults.flat());
  }

  console.log(`\nGemini finished evaluation. New matches found: ${newMatches.length}`);

  // Combine existing matches and new matches
  const combined = [...existingMatches, ...newMatches];
  const uniqueCombined = new Map<string, EvaluatedJobResult>();
  for (const match of combined) {
    const key = `${match.jobTitle.toLowerCase()}-${match.employer.toLowerCase()}`;
    if (!uniqueCombined.has(key)) {
      uniqueCombined.set(key, match);
    }
  }

  const finalList = Array.from(uniqueCombined.values());
  console.log(`Total verified matches after deduplication: ${finalList.length}`);

  // Sort: Göttingen onsite/hybrid first, then 100% Remote Germany
  finalList.sort((a, b) => {
    const aGoe = a.workplaceLocation.toLowerCase().includes('göttingen') || a.workplaceLocation.toLowerCase().includes('goettingen');
    const bGoe = b.workplaceLocation.toLowerCase().includes('göttingen') || b.workplaceLocation.toLowerCase().includes('goettingen');
    if (aGoe && !bGoe) return -1;
    if (!aGoe && bGoe) return 1;
    return a.jobTitle.localeCompare(b.jobTitle);
  });

  // Save JSON
  fs.writeFileSync('scratch/gemini_structured_results.json', JSON.stringify(finalList, null, 2));

  // Build markdown table
  let md = `# Verified English-Speaking Jobs: Göttingen & Remote Germany\n\n`;
  md += `All listed positions are located in **Göttingen** or offer **100% Remote work within Germany** with German-registered employers.\n\n`;
  md += `Every role has been verified for an **English-speaking female applicant** (degree-educated, customer care, clerk, HR, admin, zero German required).\n\n`;
  md += `| # | Job Title | Employer | Workplace Location | Category | Gemini Fit Assessment | Direct Application Link |\n`;
  md += `| :-: | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  finalList.forEach((job, index) => {
    md += `| **${index + 1}** | **${job.jobTitle}** | ${job.employer} | ${job.workplaceLocation} | ${job.category} | ${job.fitAssessment} | [Apply Here](${job.directApplicationLink}) |\n`;
  });

  fs.writeFileSync('JOBS_GOTTINGEN.md', md);
  console.log('Updated JOBS_GOTTINGEN.md successfully.');
}

main().catch(console.error);

