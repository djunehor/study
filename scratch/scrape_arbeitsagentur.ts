import fs from 'fs';
import path from 'path';

interface ArbeitsagenturJobSummary {
  stellenangebotsart?: string;
  stellenangebotsTitel: string;
  hauptberuf?: string;
  firma?: string;
  referenznummer: string;
  stellenlokationen?: Array<{
    adresse?: {
      ort?: string;
      plz?: string;
      strasse?: string;
      region?: string;
      land?: string;
    };
  }>;
  homeofficemoeglich?: boolean;
  veroeffentlichungszeitraum?: { von?: string };
}

interface RawJobData {
  source: 'arbeitsagentur';
  referenznummer: string;
  title: string;
  employer: string;
  location: string;
  isHomeOffice: boolean;
  publishedDate?: string;
  descriptionHtml?: string;
  applicationLink?: string;
  jobUrl: string;
}

const SEARCH_QUERIES = [
  // Göttingen 25km radius
  { was: 'English', wo: 'Göttingen', umkreis: 25 },
  { was: 'Customer Service', wo: 'Göttingen', umkreis: 25 },
  { was: 'Customer Support', wo: 'Göttingen', umkreis: 25 },
  { was: 'Human Resources', wo: 'Göttingen', umkreis: 25 },
  { was: 'Recruiting', wo: 'Göttingen', umkreis: 25 },
  { was: 'Operations', wo: 'Göttingen', umkreis: 25 },
  { was: 'Administration', wo: 'Göttingen', umkreis: 25 },
  { was: 'Account Manager', wo: 'Göttingen', umkreis: 25 },

  // Remote Germany
  { was: 'English Remote', wo: 'Deutschland', umkreis: 0 },
  { was: 'Customer Support Remote English', wo: 'Deutschland', umkreis: 0 },
  { was: 'Customer Success Remote English', wo: 'Deutschland', umkreis: 0 },
  { was: 'Human Resources Remote English', wo: 'Deutschland', umkreis: 0 },
  { was: 'Recruiting Remote English', wo: 'Deutschland', umkreis: 0 },
  { was: 'Operations Remote English', wo: 'Deutschland', umkreis: 0 },
  { was: 'Account Manager Remote English', wo: 'Deutschland', umkreis: 0 },
  { was: 'Customer Service Representative Remote', wo: 'Deutschland', umkreis: 0 },
];

const HEADERS = {
  'X-API-Key': 'jobboerse-jobsuche',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchJobs(was: string, wo: string, umkreis: number): Promise<ArbeitsagenturJobSummary[]> {
  const url = new URL('https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs');
  url.searchParams.set('was', was);
  url.searchParams.set('wo', wo);
  if (umkreis > 0) {
    url.searchParams.set('umkreis', String(umkreis));
  }
  url.searchParams.set('page', '1');
  url.searchParams.set('size', '50');

  try {
    const res = await fetch(url.toString(), { headers: HEADERS });
    if (!res.ok) {
      console.warn(`[Search Warning] Query '${was}' in '${wo}' returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { ergebnisliste?: ArbeitsagenturJobSummary[] };
    return data.ergebnisliste || [];
  } catch (err) {
    console.warn(`[Search Error] Query '${was}' in '${wo}':`, err);
    return [];
  }
}

async function fetchJobDetails(referenznummer: string): Promise<{ description?: string; link?: string }> {
  const b64 = Buffer.from(referenznummer, 'utf-8').toString('base64');
  const url = `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/${b64}`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      stellenangebotsBeschreibung?: string;
      allianzpartnerUrl?: string;
      externeUrl?: string;
    };
    return {
      description: data.stellenangebotsBeschreibung,
      link: data.externeUrl || data.allianzpartnerUrl,
    };
  } catch {
    return {};
  }
}

async function main() {
  console.log('=== Starting Arbeitsagentur Jobsuche Scraper ===');
  const rawJobsMap = new Map<string, RawJobData>();

  for (const q of SEARCH_QUERIES) {
    console.log(`Searching: '${q.was}' in '${q.wo}' (radius: ${q.umkreis}km)...`);
    const results = await searchJobs(q.was, q.wo, q.umkreis);
    console.log(`  Found ${results.length} items.`);

    for (const r of results) {
      if (!r.referenznummer || rawJobsMap.has(r.referenznummer)) continue;

      const loc = r.stellenlokationen?.[0]?.adresse;
      const city = loc?.ort || q.wo;
      const isRemote = r.homeofficemoeglich || q.was.toLowerCase().includes('remote') || city.toLowerCase().includes('deutschlandweit');

      rawJobsMap.set(r.referenznummer, {
        source: 'arbeitsagentur',
        referenznummer: r.referenznummer,
        title: r.stellenangebotsTitel,
        employer: r.firma || 'Unlisted Employer',
        location: isRemote ? 'Remote (Germany)' : `${city}, Lower Saxony`,
        isHomeOffice: Boolean(isRemote),
        publishedDate: r.veroeffentlichungszeitraum?.von,
        jobUrl: `https://www.arbeitsagentur.de/jobsuche/jobdetail/${r.referenznummer}`,
      });
    }

    await sleep(200);
  }

  console.log(`\nTotal unique jobs discovered from search lists: ${rawJobsMap.size}`);
  console.log('Fetching descriptions and external ATS application links...');

  let fetched = 0;
  for (const [refnr, job] of rawJobsMap.entries()) {
    fetched++;
    if (fetched % 20 === 0 || fetched === rawJobsMap.size) {
      console.log(`  Fetched details for ${fetched}/${rawJobsMap.size}...`);
    }

    const details = await fetchJobDetails(refnr);
    if (details.description) {
      job.descriptionHtml = details.description;
    }
    if (details.link) {
      job.applicationLink = details.link.startsWith('http') ? details.link : `https://${details.link}`;
    } else {
      job.applicationLink = job.jobUrl;
    }

    await sleep(100);
  }

  const jobsList = Array.from(rawJobsMap.values());
  const outPath = path.join(process.cwd(), 'scratch', 'arbeitsagentur_raw_jobs.json');
  fs.writeFileSync(outPath, JSON.stringify(jobsList, null, 2), 'utf-8');
  console.log(`\nSuccessfully saved ${jobsList.length} raw Arbeitsagentur jobs to ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal scrape error:', err);
  process.exit(1);
});

