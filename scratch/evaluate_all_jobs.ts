import { GoogleGenAI } from '@google/genai';
import { execSync } from 'child_process';
import * as fs from 'fs';

interface RawJob {
  id: string;
  title: string;
  employer: string;
  location: string;
  isRemote: boolean;
  url: string;
  description: string;
  source: string;
}

interface EvaluatedMatch {
  title: string;
  employer: string;
  location: string;
  workplaceType: 'Göttingen (Onsite/Hybrid)' | '100% Remote';
  url: string;
  source: string;
  matchReason: string;
  languageRequirement: string;
}

// Load GEMINI_API_KEY from .dev.vars if not in env
let apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && fs.existsSync('.dev.vars')) {
  const content = fs.readFileSync('.dev.vars', 'utf-8');
  const match = content.match(/GEMINI_API_KEY=([^\s]+)/);
  if (match) apiKey = match[1];
}

async function collectAllJobs(): Promise<RawJob[]> {
  const jobs: RawJob[] = [];

  console.log('1. Collecting University of Göttingen Vacancies...');
  try {
    const res = await fetch('https://www.uni-goettingen.de/api/v1/get/vacancies?lang=en');
    const data = await res.json();
    if (data.rows) {
      for (const row of data.rows) {
        const cleanTitle = row.titel
          .replace(/<[^>]+>/g, '')
          .replace(/&#252;/g, 'ü')
          .replace(/&#246;/g, 'ö')
          .replace(/&#228;/g, 'ä')
          .replace(/&quot;/g, '"');
        const cleanInst = row.institut.replace(/<[^>]+>/g, '');
        jobs.push({
          id: `uni-${row.id}`,
          title: cleanTitle,
          employer: `University of Göttingen (${cleanInst})`,
          location: 'Göttingen',
          isRemote: false,
          url: `https://www.uni-goettingen.de/de/644546.html?details=${row.id}`,
          description: `Besoldung: ${row.besoldGrp}, Frist: ${row.frist}, Dauer: ${row.dauer}`,
          source: 'University of Göttingen'
        });
      }
    }
  } catch (err) {
    console.error('Error fetching Uni Göttingen:', err);
  }

  console.log('2. Collecting Sartorius Göttingen & Remote Germany Vacancies...');
  try {
    for (const offset of [0, 20, 40]) {
      const res = await fetch('https://sartorius.wd3.myworkdayjobs.com/wday/cxs/sartorius/sartoriuscareers/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: 'Goettingen' })
      });
      const data = await res.json();
      if (data.jobPostings) {
        for (const job of data.jobPostings) {
          jobs.push({
            id: `sartorius-${job.bulletFields?.[0] || Math.random()}`,
            title: job.title,
            employer: 'Sartorius AG',
            location: job.locationsText || 'Göttingen',
            isRemote: (job.locationsText || '').toLowerCase().includes('remote') || (job.locationsText || '').toLowerCase().includes('home office'),
            url: `https://sartorius.wd3.myworkdayjobs.com/sartoriuscareers${job.externalPath}`,
            description: `Job ID: ${job.bulletFields?.[0] || 'N/A'}, Posted: ${job.postedOn}`,
            source: 'Sartorius Careers'
          });
        }
      }
    }
  } catch (err) {
    console.error('Error fetching Sartorius:', err);
  }

  console.log('3. Collecting Stellenwerk Göttingen Vacancies...');
  try {
    const stellenwerkHtml = execSync(
      `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --dump-dom --virtual-time-budget=4000 "https://www.stellenwerk.de/goettingen/" 2>/dev/null`,
      { maxBuffer: 10 * 1024 * 1024 }
    ).toString();
    const matches = stellenwerkHtml.matchAll(/href="(\/goettingen\/[^"]+)"/g);
    for (const match of matches) {
      const link = match[1];
      if (!link.includes('events') && !link.includes('login') && !link.includes('magazin')) {
        const cleanTitle = link.replace('/goettingen/', '').split('-').slice(0, -2).join(' ');
        jobs.push({
          id: `stellenwerk-${link}`,
          title: cleanTitle,
          employer: 'Stellenwerk Employer (Göttingen)',
          location: 'Göttingen Area',
          isRemote: false,
          url: `https://www.stellenwerk.de${link}`,
          description: cleanTitle,
          source: 'Stellenwerk Göttingen'
        });
      }
    }
  } catch (err) {
    console.error('Error scanning Stellenwerk:', err);
  }

  console.log('4. Collecting 100% Remote Jobs in Germany (Arbeitnow API)...');
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
    const data = await res.json();
    if (data.data) {
      const remoteJobs = data.data.filter((j: any) => j.remote);
      for (const r of remoteJobs) {
        jobs.push({
          id: `arbeitnow-${r.slug}`,
          title: r.title,
          employer: r.company_name,
          location: '100% Remote (Germany)',
          isRemote: true,
          url: r.url,
          description: r.description.replace(/<[^>]+>/g, ' ').slice(0, 1000),
          source: 'Arbeitnow Remote'
        });
      }
    }
  } catch (err) {
    console.error('Error fetching Arbeitnow:', err);
  }

  console.log(`Total jobs collected across portals: ${jobs.length}`);
  return jobs;
}

async function evaluateJobs(jobs: RawJob[]): Promise<EvaluatedMatch[]> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  const client = new GoogleGenAI({ apiKey });
  const matches: EvaluatedMatch[] = [];

  const systemPrompt = `You are a career admissions officer evaluating jobs for an English-speaking female applicant living in Göttingen, Germany.
Her Profile:
- Speaks fluent English. Speaks ZERO or minimal German.
- Education: University graduate (BSc in International Relations + Master's in Industrial Relations and Human Resource Management).
- Experience: Customer service, customer-facing roles, administrative coordination, communications.
- Location criteria: The job must either be physically in/near Göttingen OR 100% Remote (work from home anywhere in Germany).

Evaluation Rules:
1. ACCEPT roles suitable for an English-speaking graduate, such as:
   - Customer Care, Customer Success, Customer Service, Support Specialist, Client Relations.
   - Clerk, Administrative Assistant, Office Coordinator, Operations Assistant.
   - Human Resources, Talent Acquisition, People & Culture, Recruiting, Onboarding.
   - Communications, Digital Marketing, Social Media Ambassador, Content Moderation.
   - Generalist project coordinator or academic administration suitable for an English speaker.
2. REJECT:
   - Any job requiring fluent German (e.g. C1/C2 German, or where all duties are in German).
   - Delivery jobs requiring riding a bicycle or physical parcel delivery.
   - Heavy physical/craft labor (e.g. tool mechanics, machining, cleaning, chemical processing plant workers).
   - Pure software engineering requiring specific coding stacks (unless general non-technical tech support/ops).
   - Wet-lab STEM research requiring a PhD/Master's in molecular biology, physics, or biochemistry.

Output strictly JSON with format:
{
  "matches": [
    {
      "id": "job id",
      "isMatch": true/false,
      "matchReason": "1 short sentence explaining why this fits an English-speaking female",
      "languageRequirement": "English"
    }
  ]
}`;

  const batchSize = 15;
  const batches: RawJob[][] = [];
  for (let i = 0; i < jobs.length; i += batchSize) {
    batches.push(jobs.slice(i, i + batchSize));
  }

  console.log(`Evaluating ${batches.length} batches in parallel with Gemini...`);

  await Promise.all(
    batches.map(async (batch, batchIdx) => {
      const batchInput = batch.map((j) => ({
        id: j.id,
        title: j.title,
        employer: j.employer,
        location: j.location,
        isRemote: j.isRemote,
        description: j.description.slice(0, 400),
      }));

      try {
        const response = await client.interactions.create({
          model: 'gemini-3.8-flash',
          input: `${systemPrompt}\n\nJobs to evaluate:\n${JSON.stringify(batchInput)}`,
          response_format: {
            type: 'text',
            mime_type: 'application/json',
          },
        });

        if (response.output_text) {
          const parsed = JSON.parse(response.output_text);
          if (parsed.matches && Array.isArray(parsed.matches)) {
            for (const m of parsed.matches) {
              if (m.isMatch) {
                const orig = batch.find((b) => b.id === m.id);
                if (orig) {
                  matches.push({
                    title: orig.title,
                    employer: orig.employer,
                    location: orig.location,
                    workplaceType: orig.isRemote ? '100% Remote' : 'Göttingen (Onsite/Hybrid)',
                    url: orig.url,
                    source: orig.source,
                    matchReason: m.matchReason,
                    languageRequirement: m.languageRequirement || 'English',
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error evaluating batch ${batchIdx}:`, e);
      }
    })
  );

  return matches;
}

async function main() {
  const jobs = await collectAllJobs();
  const matched = await evaluateJobs(jobs);

  console.log(`\nGemini Evaluation Complete! Found ${matched.length} matching jobs.`);
  fs.writeFileSync('scratch/gemini_matched_jobs.json', JSON.stringify(matched, null, 2));

  // Generate JOBS_GOTTINGEN.md
  let md = `# Verified English-Speaking Job Directory: Göttingen & 100% Remote Germany\n\n`;
  md += `This directory contains live jobs evaluated by **Gemini 3.8 Flash** for an **English-speaking female applicant**.\n\n`;
  md += `### Applicant Profile Considered\n`;
  md += `* **Language**: English only (no German required).\n`;
  md += `* **Education & Skills**: Degree-educated, customer care, customer support, clerk, office administration, human resources, client communication.\n`;
  md += `* **Excluded**: Delivery jobs (e.g. bicycle courier), heavy manual labor, trades, wet-lab STEM research, and jobs requiring German fluency.\n`;
  md += `* **Location Options**: Onsite/Hybrid in Göttingen OR 100% Remote across Germany.\n\n`;
  md += `---\n\n`;
  md += `## Total Matched Jobs: ${matched.length}\n\n`;

  const remote = matched.filter((m) => m.workplaceType === '100% Remote');
  const goettingen = matched.filter((m) => m.workplaceType === 'Göttingen (Onsite/Hybrid)');

  md += `### Summary\n`;
  md += `* **Göttingen (Onsite / Hybrid)**: ${goettingen.length} jobs\n`;
  md += `* **100% Remote (Work from home in Göttingen)**: ${remote.length} jobs\n\n`;
  md += `---\n\n`;

  md += `## Part 1: Göttingen Positions (Onsite / Hybrid)\n\n`;
  goettingen.forEach((j, idx) => {
    md += `### ${idx + 1}. ${j.title}\n`;
    md += `* **Employer**: ${j.employer}\n`;
    md += `* **Location**: ${j.location}\n`;
    md += `* **Source**: ${j.source}\n`;
    md += `* **Gemini Evaluation**: ${j.matchReason}\n`;
    md += `* **Direct Job Link**: [View and Apply](${j.url})\n\n`;
  });

  md += `## Part 2: 100% Remote Positions (Accessible from Göttingen)\n\n`;
  remote.forEach((j, idx) => {
    md += `### ${idx + 1}. ${j.title}\n`;
    md += `* **Employer**: ${j.employer}\n`;
    md += `* **Location**: ${j.location}\n`;
    md += `* **Source**: ${j.source}\n`;
    md += `* **Gemini Evaluation**: ${j.matchReason}\n`;
    md += `* **Direct Job Link**: [View and Apply](${j.url})\n\n`;
  });

  fs.writeFileSync('JOBS_GOTTINGEN.md', md);
  console.log('JOBS_GOTTINGEN.md successfully updated!');
}

main();
