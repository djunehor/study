import { GoogleGenAI, Type } from '@google/genai';
import { execSync } from 'child_process';
import * as fs from 'fs';

interface RawJobListing {
  jobId: string;
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

// 2. Collect raw listings from all portals without manual regex/keyword filtering
async function collectAllRawJobs(): Promise<RawJobListing[]> {
  const listings: RawJobListing[] = [];

  // A. University of Göttingen API
  console.log('Collecting University of Göttingen vacancies...');
  try {
    const res = await fetch('https://www.uni-goettingen.de/api/v1/get/vacancies?lang=en');
    const data = await res.json();
    if (data.rows && Array.isArray(data.rows)) {
      for (const row of data.rows) {
        listings.push({
          jobId: `uni-${row.id}`,
          jobTitle: row.titel.replace(/<[^>]+>/g, '').trim(),
          employer: `University of Göttingen (${row.institut?.replace(/<[^>]+>/g, '').trim() || 'General'})`,
          location: 'Göttingen',
          directUrl: `http://obp.uni-goettingen.de/de-de/OBF/Index/${row.id}`,
          rawDescription: `Salary group: ${row.besoldGrp}, Deadline: ${row.frist}, Duration: ${row.dauer}, Institut: ${row.institut}`
        });
      }
    }
  } catch (err) {
    console.error('Error reading Uni Göttingen:', err);
  }

  // B. Sartorius Workday API (Göttingen and Remote Germany)
  console.log('Collecting Sartorius vacancies...');
  try {
    for (const offset of [0, 20, 40]) {
      const res = await fetch('https://sartorius.wd3.myworkdayjobs.com/wday/cxs/sartorius/sartoriuscareers/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: 'Goettingen' })
      });
      const data = await res.json();
      if (data.jobPostings && Array.isArray(data.jobPostings)) {
        for (const job of data.jobPostings) {
          listings.push({
            jobId: `sartorius-${job.bulletFields?.[0] || job.title}`,
            jobTitle: job.title,
            employer: 'Sartorius AG',
            location: job.locationsText || 'Göttingen',
            directUrl: `https://sartorius.wd3.myworkdayjobs.com/sartoriuscareers${job.externalPath}`,
            rawDescription: `Job Requisition: ${job.bulletFields?.[0] || 'N/A'}, Posted: ${job.postedOn}`
          });
        }
      }
    }
  } catch (err) {
    console.error('Error reading Sartorius:', err);
  }

  // C. Stellenwerk Göttingen Portal
  console.log('Collecting Stellenwerk Göttingen jobs...');
  try {
    const stellenwerkHtml = execSync(
      `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --dump-dom --virtual-time-budget=4000 "https://www.stellenwerk.de/goettingen/" 2>/dev/null`,
      { maxBuffer: 10 * 1024 * 1024 }
    ).toString();

    const matches = stellenwerkHtml.matchAll(/href="(\/goettingen\/[^"]+)"/g);
    const seenLinks = new Set<string>();
    for (const match of matches) {
      const link = match[1];
      if (seenLinks.has(link) || link.includes('events') || link.includes('login') || link.includes('magazin')) {
        continue;
      }
      seenLinks.add(link);
      const slugTitle = link.replace('/goettingen/', '').split('-').slice(0, -2).join(' ');
      listings.push({
        jobId: `stellenwerk-${link}`,
        jobTitle: slugTitle,
        employer: 'Stellenwerk Employer',
        location: 'Göttingen Area',
        directUrl: `https://www.stellenwerk.de${link}`,
        rawDescription: `Job listed on Göttingen Stellenwerk: ${slugTitle}`
      });
    }
  } catch (err) {
    console.error('Error reading Stellenwerk:', err);
  }

  // D. Arbeitnow Remote Jobs
  console.log('Collecting Arbeitnow remote vacancies...');
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
    const data = await res.json();
    if (data.data && Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item.remote) {
          listings.push({
            jobId: `arbeitnow-${item.slug}`,
            jobTitle: item.title,
            employer: item.company_name,
            location: '100% Remote (Germany)',
            directUrl: item.url,
            rawDescription: item.description ? item.description.replace(/<[^>]+>/g, ' ').slice(0, 1500) : ''
          });
        }
      }
    }
  } catch (err) {
    console.error('Error reading Arbeitnow:', err);
  }

  // E. EnglishJobs.de Remote Vacancies
  console.log('Collecting EnglishJobs.de remote vacancies...');
  try {
    const res = await fetch('https://englishjobs.de/jobs/remote?format=markdown');
    if (res.ok) {
      const text = await res.text();
      const blocks = text.split(/\[###\s+/);
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const titleMatch = block.match(/^([^\n\]]+)\]\(([^)]+)\)/);
        if (!titleMatch) continue;
        const title = titleMatch[1].trim();
        const clickoutUrl = `https://englishjobs.de${titleMatch[2].trim()}`;
        const meta = block.match(/\*\s*([^\n\*]+)\n\*\s*([^\n\*]+)\n\*\s*([^\n\*]+)\n\*\s*remote work/);
        const company = meta ? meta[1].trim() : 'Company';
        const city = meta ? meta[2].trim() : 'Germany';
        const desc = block.split('\n\n').slice(2).join(' ').replace(/report problem[\s\S]*$/, '').trim();

        listings.push({
          jobId: `englishjobs-${i}`,
          jobTitle: title,
          employer: company,
          location: `${city} (100% Remote)`,
          directUrl: clickoutUrl,
          rawDescription: desc
        });
      }
    }
  } catch (err) {
    console.error('Error reading EnglishJobs:', err);
  }

  // F. Stepstone Scraped Listings (Göttingen and 100% Remote Germany)
  console.log('Collecting Stepstone scraped vacancies from scratch/stepstone_raw_jobs.json...');
  if (fs.existsSync('scratch/stepstone_raw_jobs.json')) {
    try {
      const stepstoneJobs = JSON.parse(fs.readFileSync('scratch/stepstone_raw_jobs.json', 'utf-8'));
      if (Array.isArray(stepstoneJobs)) {
        for (const sj of stepstoneJobs) {
          listings.push({
            jobId: sj.jobId,
            jobTitle: sj.jobTitle,
            employer: sj.employer,
            location: sj.location,
            directUrl: sj.directUrl,
            rawDescription: sj.rawDescription
          });
        }
        console.log(`Loaded ${stepstoneJobs.length} listings from Stepstone.`);
      }
    } catch (err) {
      console.error('Error reading Stepstone JSON:', err);
    }
  }

  // G. Indeed Scraped Listings (Göttingen and Remote Germany)
  console.log('Collecting Indeed scraped vacancies from scratch/indeed_raw_jobs.json...');
  if (fs.existsSync('scratch/indeed_raw_jobs.json')) {
    try {
      const indeedJobs = JSON.parse(fs.readFileSync('scratch/indeed_raw_jobs.json', 'utf-8'));
      if (Array.isArray(indeedJobs)) {
        for (const ij of indeedJobs) {
          listings.push({
            jobId: ij.jobId,
            jobTitle: ij.jobTitle,
            employer: ij.employer,
            location: ij.location,
            directUrl: ij.directUrl,
            rawDescription: ij.rawDescription
          });
        }
        console.log(`Loaded ${indeedJobs.length} listings from Indeed.`);
      }
    } catch (err) {
      console.error('Error reading Indeed JSON:', err);
    }
  }

  console.log(`Total raw job listings collected: ${listings.length}`);
  return listings;
}

// 3. Structured schema for Gemini
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

async function evaluateAllJobsWithGemini(jobs: RawJobListing[]): Promise<EvaluatedJobResult[]> {
  const batchSize = 10;
  const batches: RawJobListing[][] = [];
  for (let i = 0; i < jobs.length; i += batchSize) {
    batches.push(jobs.slice(i, i + batchSize));
  }

  console.log(`Sending ${batches.length} batches to Gemini with structured output schema (chunk concurrency = 4)...`);
  const allMatches: EvaluatedJobResult[] = [];

  // Process in chunks of 4 parallel batches to prevent network congestion
  const concurrency = 4;
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
    allMatches.push(...chunkResults.flat());
  }

  return allMatches;
}

async function main() {
  const rawListings = await collectAllRawJobs();
  const matchedJobs = await evaluateAllJobsWithGemini(rawListings);

  console.log(`\nGemini finished evaluation. Total matched jobs: ${matchedJobs.length}`);

  // Deduplicate matched jobs by title + employer
  const uniqueMatches = new Map<string, EvaluatedJobResult>();
  for (const match of matchedJobs) {
    const key = `${match.jobTitle.toLowerCase()}-${match.employer.toLowerCase()}`;
    if (!uniqueMatches.has(key)) {
      uniqueMatches.set(key, match);
    }
  }

  const finalList = Array.from(uniqueMatches.values());
  console.log(`Unique matched jobs: ${finalList.length}`);

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
