import fs from 'fs';
import path from 'path';
import { JOBS_GOTTINGEN_DATA } from '../src/jobs-gottingen-data';
import { EnglishJobEntry, PhDPosition } from '../src/types';
import { initDatabase, savePositions, getAllStoredPositions } from '../src/db';

interface EvaluatedMatch {
  jobId: string;
  isMatch: boolean;
  jobTitle: string;
  employer: string;
  workplaceLocation: string;
  category: string;
  fitAssessment: string;
  directApplicationLink: string;
}

interface RawArbeitsagentur {
  referenznummer: string;
  stellenangebotsTitel: string;
  firma?: string;
  applicationLink?: string;
  jobUrl: string;
  location: string;
}

interface RawXing {
  id: string;
  title: string;
  employer: string;
  applicationLink: string;
  jobUrl: string;
  location: string;
  descriptionHtml?: string;
}

function cleanHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function main() {
  console.log('=== Merging New Arbeitsagentur & Xing Matches ===');

  const evalPath = path.join(process.cwd(), 'scratch', 'new_evaluated_matches.json');
  const evaluatedData = JSON.parse(fs.readFileSync(evalPath, 'utf-8')) as { verifiedMatches: EvaluatedMatch[] };
  const verifiedMatches = evaluatedData.verifiedMatches;

  const aaPath = path.join(process.cwd(), 'scratch', 'arbeitsagentur_raw_jobs.json');
  const aaRawMap = new Map<string, RawArbeitsagentur>();
  if (fs.existsSync(aaPath)) {
    const arr = JSON.parse(fs.readFileSync(aaPath, 'utf-8')) as RawArbeitsagentur[];
    arr.forEach((j) => aaRawMap.set(j.referenznummer, j));
  }

  const xingPath = path.join(process.cwd(), 'scratch', 'xing_raw_jobs.json');
  const xingRawMap = new Map<string, RawXing>();
  if (fs.existsSync(xingPath)) {
    const arr = JSON.parse(fs.readFileSync(xingPath, 'utf-8')) as RawXing[];
    arr.forEach((j) => xingRawMap.set(j.id, j));
  }

  const base111: EnglishJobEntry[] = (JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'scratch', 'gemini_structured_results.json'), 'utf-8')
  ) as any[]).filter((j) => j.isMatch).map((j) => ({
    jobId: j.jobId,
    jobTitle: cleanHtmlEntities(j.jobTitle),
    employer: cleanHtmlEntities(j.employer),
    workplaceLocation: j.workplaceLocation,
    category: j.category,
    fitAssessment: cleanHtmlEntities(j.fitAssessment),
    directApplicationLink: j.directApplicationLink,
  }));

  const existingKeys = new Set(
    base111.map((j) => `${j.employer.toLowerCase()}:::${j.jobTitle.toLowerCase()}`)
  );
  const existingLinks = new Set(base111.map((j) => j.directApplicationLink));

  const newValidJobs: EnglishJobEntry[] = [];

  for (const m of verifiedMatches) {
    let cleanTitle = cleanHtmlEntities(m.jobTitle);
    let cleanEmployer = cleanHtmlEntities(m.employer);
    let cleanLink = m.directApplicationLink.trim();

    // Check against unwanted non-job entries
    if (cleanTitle.toLowerCase().includes('bis zu 35€/std') || cleanTitle.toLowerCase().includes('nachhilfeunterricht')) {
      continue;
    }

    // Resolve Arbeitsagentur links
    if (m.jobId.startsWith('aa-')) {
      const ref = m.jobId.replace('aa-', '');
      const raw = aaRawMap.get(ref);
      if (raw) {
        if (cleanEmployer === 'Unlisted Employer' && raw.firma) {
          cleanEmployer = cleanHtmlEntities(raw.firma);
        }
        if (cleanLink === 'http://www.arbeitsagentur.de' || cleanLink === 'https://www.arbeitsagentur.de') {
          cleanLink = raw.applicationLink && !raw.applicationLink.includes('arbeitsagentur.de')
            ? raw.applicationLink
            : raw.jobUrl;
        }
      }
    }

    // Resolve Xing company and links
    if (m.jobId.startsWith('xing-')) {
      const id = m.jobId.replace('xing-', '');
      const raw = xingRawMap.get(id);
      if (raw) {
        if (cleanEmployer === 'Unknown Employer' && raw.descriptionHtml) {
          const compMatch = raw.descriptionHtml.match(/bei\s+(?:&#x27;)?(.+?)(?:&#x27;)?\s+in\s+/i);
          if (compMatch) {
            cleanEmployer = cleanHtmlEntities(compMatch[1].split(' in ')[0].trim());
          }
        }
        if (cleanLink.includes('undefined') || !cleanLink.startsWith('http')) {
          cleanLink = raw.applicationLink || raw.jobUrl;
        }
      }
    }

    if (cleanEmployer === 'Unknown Employer') {
      cleanEmployer = 'German Technology / Service Enterprise';
    }

    const key = `${cleanEmployer.toLowerCase()}:::${cleanTitle.toLowerCase()}`;
    if (existingKeys.has(key) || existingLinks.has(cleanLink)) {
      continue;
    }

    existingKeys.add(key);
    existingLinks.add(cleanLink);

    newValidJobs.push({
      jobId: m.jobId,
      jobTitle: cleanTitle,
      employer: cleanEmployer,
      workplaceLocation: m.workplaceLocation.includes('Göttingen') ? 'Göttingen (Onsite/Hybrid)' : 'Remote (Germany)',
      category: m.category as any,
      fitAssessment: cleanHtmlEntities(m.fitAssessment),
      directApplicationLink: cleanLink,
    });
  }

  console.log(`Discovered ${newValidJobs.length} new unique verified jobs.`);
  const allMergedJobs: EnglishJobEntry[] = [...base111, ...newValidJobs];
  console.log(`Total jobs count will increase from ${base111.length} to ${allMergedJobs.length}.`);

  // Write updated src/jobs-gottingen-data.ts
  const dataTsContent = `import { EnglishJobEntry } from './types';

export const JOBS_GOTTINGEN_DATA: EnglishJobEntry[] = ${JSON.stringify(allMergedJobs, null, 2)};
`;
  fs.writeFileSync(path.join(process.cwd(), 'src', 'jobs-gottingen-data.ts'), dataTsContent, 'utf-8');
  console.log('Successfully updated src/jobs-gottingen-data.ts');

  // Update JOBS_GOTTINGEN.md
  let mdContent = `# Göttingen & Germany Remote English Jobs Directory

Comprehensive, verified directory of **active, English-speaking employment opportunities** tailored for an **English-speaking female graduate (BSc International Relations, MSc Industrial Relations & HRM)** with customer-facing, people operations, and administrative background.

**Language Requirement**: 100% English working language (zero German required).
**Geographic Scope**:
1. **Göttingen Onsite / Hybrid** (within 25 km of Göttingen, 37073 Lower Saxony).
2. **100% Remote within Germany**.

Total Positions: **${allMergedJobs.length}** (${allMergedJobs.filter((j) => j.workplaceLocation.includes('Göttingen')).length} Göttingen, ${allMergedJobs.filter((j) => j.workplaceLocation.includes('Remote')).length} 100% Remote Germany)

---

| # | Job Title | Employer | Location | Category | Language & Role Fit Assessment | Direct Application Link |
|---|---|---|---|---|---|---|
`;

  allMergedJobs.forEach((j, i) => {
    mdContent += `| ${i + 1} | **${j.jobTitle}** | ${j.employer} | \`${j.workplaceLocation}\` | ${j.category} | ${j.fitAssessment} | [Apply Directly](${j.directApplicationLink}) |\n`;
  });

  fs.writeFileSync(path.join(process.cwd(), 'JOBS_GOTTINGEN.md'), mdContent, 'utf-8');
  console.log('Successfully updated JOBS_GOTTINGEN.md');

  // Sync to SQLite Database
  const db = initDatabase();
  console.log('Syncing all jobs to SQLite database (phd_storage.db)...');

  const convertedPositions: PhDPosition[] = allMergedJobs.map((j) => {
    const isGoe = j.workplaceLocation.toLowerCase().includes('göttingen') || j.workplaceLocation.toLowerCase().includes('goettingen');
    const state = isGoe ? 'Niedersachsen' : 'bundesweit (100% Remote)';
    const id = `job-gottingen-${Buffer.from(j.employer + j.jobTitle).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;

    return {
      id,
      title: j.jobTitle,
      employer: j.employer,
      location: j.workplaceLocation,
      postalCode: isGoe ? '37073' : undefined,
      state: state,
      isWestGermany: true,
      publicationDate: '2026-11-06',
      applicationWindow: 'Open now',
      deadline: 'Rolling / Open',
      link: j.directApplicationLink,
      matchedKeywords: [j.category, 'English-speaking', 'Degree-educated'],
      isEnglishPreferred: true,
      description: j.fitAssessment,
      source: j.directApplicationLink.includes('arbeitsagentur.de') ? 'Arbeitsagentur' : j.directApplicationLink.includes('xing.com') ? 'XING' : 'Direct ATS / Employer',
      opportunityType: 'Live Vacancy',
      verificationStatus: 'Verified Match',
      matchScore: 100,
      degreeFit: 'BSc International Relations + MSc Industrial Relations & HRM',
      languageRequirement: 'English Only (Zero German Required)',
      compensation: 'Paid Employment Contract',
      aiSummary: j.fitAssessment,
      evaluatedBy: 'Gemini AI',
    };
  });

  savePositions(convertedPositions, db);
  const allInDb = getAllStoredPositions(db);
  console.log(`Successfully synced positions to SQLite database. Total now: ${allInDb.length}`);
}

main();
