import fs from 'fs';
import path from 'path';

interface RawXingJob {
  source: 'xing';
  id: string;
  title: string;
  employer: string;
  location: string;
  isRemote: boolean;
  jobUrl: string;
  applicationLink: string;
  descriptionHtml?: string;
  keywords?: string[];
}

const XING_QUERIES = [
  // Göttingen
  { keywords: 'English', location: 'Göttingen' },
  { keywords: 'Customer Service English', location: 'Göttingen' },
  { keywords: 'Operations English', location: 'Göttingen' },
  { keywords: 'Human Resources English', location: 'Göttingen' },
  { keywords: 'Account Manager English', location: 'Göttingen' },

  // Remote
  { keywords: 'English Customer Support Remote', location: 'Deutschland' },
  { keywords: 'English Customer Success Remote', location: 'Deutschland' },
  { keywords: 'English Human Resources Remote', location: 'Deutschland' },
  { keywords: 'English Operations Remote', location: 'Deutschland' },
  { keywords: 'English Account Manager Remote', location: 'Deutschland' },
  { keywords: 'Customer Service Representative English Remote', location: 'Deutschland' },
];

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchXing(keywords: string, location: string): Promise<RawXingJob[]> {
  const encKeywords = encodeURIComponent(keywords);
  const encLocation = encodeURIComponent(location);
  const url = `https://www.xing.com/jobs/search/ki?keywords=${encKeywords}&location=${encLocation}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      console.warn(`[Xing Search Warning] Query '${keywords}' returned ${res.status}`);
      return [];
    }
    const html = await res.text();
    const cards = html.split('data-testid="job-search-result"').slice(1);
    const jobs: RawXingJob[] = [];

    for (const card of cards) {
      const linkMatch = card.match(/href="(\/jobs\/[^"?#]+)/);
      const titleMatch = card.match(/aria-label="([^".]+)/);
      if (!linkMatch || !titleMatch) continue;

      const pathPart = linkMatch[1];
      const idMatch = pathPart.match(/-(\d+)$/);
      const id = idMatch ? idMatch[1] : pathPart;
      const fullJobUrl = `https://www.xing.com${pathPart}`;

      // Try extract company name from card
      const compMatch = card.match(/<span[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                        card.match(/data-qa="company-name"[^>]*>([^<]+)</i);
      const employer = compMatch ? compMatch[1].trim() : 'Unknown Employer';

      const isRemote = keywords.toLowerCase().includes('remote') || location.toLowerCase().includes('remote') || pathPart.includes('remote');

      jobs.push({
        source: 'xing',
        id,
        title: titleMatch[1].trim(),
        employer,
        location: isRemote ? 'Remote (Germany)' : `${location}, Lower Saxony`,
        isRemote,
        jobUrl: fullJobUrl,
        applicationLink: fullJobUrl,
      });
    }

    return jobs;
  } catch (err) {
    console.warn(`[Xing Search Error] Query '${keywords}':`, err);
    return [];
  }
}

async function enrichXingJob(job: RawXingJob): Promise<void> {
  try {
    const res = await fetch(job.jobUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return;
    const html = await res.text();

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    if (descMatch) {
      job.descriptionHtml = descMatch[1];
      // Often description has: "'Title' bei Company in Location. ..."
      const beiMatch = descMatch[1].match(/bei\s+([^in]+?)\s+in\s+([^.]+)/i);
      if (beiMatch && job.employer === 'Unknown Employer') {
        job.employer = beiMatch[1].trim();
      }
    }

    // Extract keywords
    const kwMatch = html.match(/<meta[^>]*name="keywords"[^>]*content="([^"]+)"/i);
    if (kwMatch) {
      job.keywords = kwMatch[1].split(',').map((k) => k.trim());
    }

    // Extract ATS link (iventajobdata or direct company careers)
    const extRegex = /href="(https:\/\/[^"]+)"/g;
    let m;
    while ((m = extRegex.exec(html)) !== null) {
      const link = m[1];
      if (link.includes('iventajobdata.eu') && link.includes('JeyJvbGRsaW5r')) {
        // Base64 decode oldlink
        try {
          const b64Part = link.split('JeyJvbGRsaW5r')[1].split('/')[0];
          const fullB64 = 'eyJvbGRsaW5r' + b64Part;
          const decoded = Buffer.from(fullB64, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded) as { oldlink?: string };
          if (parsed.oldlink) {
            job.applicationLink = parsed.oldlink;
            break;
          }
        } catch {
          // ignore decode error
        }
      } else if (
        !link.includes('xing.com') &&
        !link.includes('xingcdn.com') &&
        !link.includes('new-work.se') &&
        !link.includes('bewerbung.com') &&
        !link.includes('lebenslauf.com') &&
        !link.includes('anschreiben.com') &&
        (link.includes('greenhouse') || link.includes('workday') || link.includes('lever') || link.includes('ashby') || link.includes('jobs.'))
      ) {
        job.applicationLink = link;
        break;
      }
    }
  } catch {
    // ignore fetch errors
  }
}

async function main() {
  console.log('=== Starting Xing Jobs Scraper ===');
  const uniqueJobsMap = new Map<string, RawXingJob>();

  for (const q of XING_QUERIES) {
    console.log(`Searching Xing: '${q.keywords}' in '${q.location}'...`);
    const results = await searchXing(q.keywords, q.location);
    console.log(`  Found ${results.length} items.`);

    for (const j of results) {
      if (!uniqueJobsMap.has(j.id)) {
        uniqueJobsMap.set(j.id, j);
      }
    }

    await sleep(300);
  }

  console.log(`\nTotal unique jobs discovered on Xing: ${uniqueJobsMap.size}`);
  console.log('Enriching Xing jobs with direct descriptions and ATS links...');

  let count = 0;
  for (const job of uniqueJobsMap.values()) {
    count++;
    if (count % 15 === 0 || count === uniqueJobsMap.size) {
      console.log(`  Enriched ${count}/${uniqueJobsMap.size}...`);
    }
    await enrichXingJob(job);
    await sleep(150);
  }

  const jobsList = Array.from(uniqueJobsMap.values());
  const outPath = path.join(process.cwd(), 'scratch', 'xing_raw_jobs.json');
  fs.writeFileSync(outPath, JSON.stringify(jobsList, null, 2), 'utf-8');
  console.log(`\nSuccessfully saved ${jobsList.length} raw Xing jobs to ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal scrape error:', err);
  process.exit(1);
});

