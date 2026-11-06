import { execSync } from 'child_process';
import * as fs from 'fs';

interface JobSummary {
  title: string;
  employer: string;
  location: string;
  source: string;
  url: string;
  referenceId?: string;
}

async function scanAllPortals() {
  const collectedJobs: JobSummary[] = [];

  console.log('1. Scanning Sartorius Workday API (Goettingen)...');
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
          collectedJobs.push({
            title: job.title,
            employer: 'Sartorius AG',
            location: 'Göttingen',
            source: 'Sartorius Workday',
            url: `https://sartorius.wd3.myworkdayjobs.com/sartoriuscareers${job.externalPath}`,
            referenceId: job.bulletFields?.[0]
          });
        }
      }
    }
  } catch (err) {
    console.error('Error fetching Sartorius:', err);
  }

  console.log('2. Scanning University of Göttingen Vacancy API...');
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
        collectedJobs.push({
          title: cleanTitle,
          employer: `University of Göttingen (${cleanInst})`,
          location: 'Göttingen',
          source: 'Uni Göttingen Official API',
          url: `https://www.uni-goettingen.de/de/644546.html`,
          referenceId: row.id
        });
      }
    }
  } catch (err) {
    console.error('Error fetching Uni Göttingen:', err);
  }

  console.log('3. Scanning Stellenwerk Göttingen with Headless Chrome Browser...');
  try {
    const stellenwerkHtml = execSync(
      `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --dump-dom --virtual-time-budget=4000 "https://www.stellenwerk.de/goettingen/" 2>/dev/null`,
      { maxBuffer: 10 * 1024 * 1024 }
    ).toString();
    const matches = stellenwerkHtml.matchAll(/href="(\/goettingen\/[^"]+)"/g);
    for (const match of matches) {
      const link = match[1];
      if (!link.includes('events') && !link.includes('login') && !link.includes('magazin')) {
        collectedJobs.push({
          title: link.replace('/goettingen/', '').split('-').slice(0, -2).join(' '),
          employer: 'Stellenwerk Göttingen Employer',
          location: 'Göttingen',
          source: 'Stellenwerk Göttingen',
          url: `https://www.stellenwerk.de${link}`
        });
      }
    }
  } catch (err) {
    console.error('Error scanning Stellenwerk:', err);
  }

  console.log(`Scan completed. Total positions retrieved: ${collectedJobs.length}`);
  fs.writeFileSync('scratch/collected_jobs.json', JSON.stringify(collectedJobs, null, 2));
}

scanAllPortals();

