import { createApp } from '../src/server';
import { renderDashboardHtml } from '../src/ui';
import { JOBS_GOTTINGEN_DATA } from '../src/jobs-gottingen-data';
import { generateEnglishJobsCsv } from '../src/exporter';

async function runTests() {
  console.log('=== TEST 1: LOGIC TESTS ===');

  // Check 1: Data count
  if (JOBS_GOTTINGEN_DATA.length !== 164) {
    throw new Error(`Expected 164 jobs, got ${JOBS_GOTTINGEN_DATA.length}`);
  }
  console.log('PASS: JOBS_GOTTINGEN_DATA has 164 verified entries.');

  // Check 2: Fields completeness
  for (const [idx, job] of JOBS_GOTTINGEN_DATA.entries()) {
    if (!job.jobTitle || !job.employer || !job.workplaceLocation || !job.category || !job.directApplicationLink) {
      throw new Error(`Job #${idx + 1} has missing required fields: ${JSON.stringify(job)}`);
    }
  }
  console.log('PASS: All 164 jobs have valid non-empty fields and deep-links.');

  // Check 3: CSV generation
  const csv = generateEnglishJobsCsv(JOBS_GOTTINGEN_DATA);
  if (!csv.startsWith('\uFEFF')) {
    throw new Error('CSV missing UTF-8 BOM');
  }
  const lines = csv.trim().split('\r\n');
  if (lines.length !== 165) { // 1 header + 164 data rows
    throw new Error(`Expected 165 CSV lines, got ${lines.length}`);
  }
  console.log('PASS: generateEnglishJobsCsv correctly generated UTF-8 BOM CSV with 164 rows.');

  // Check 4: Server endpoints
  const app = createApp();

  // Test /api/gottingen-jobs
  const resApi = await app.request('/api/gottingen-jobs');
  if (resApi.status !== 200) {
    throw new Error(`/api/gottingen-jobs returned status ${resApi.status}`);
  }
  const jsonApi = await resApi.json();
  if (jsonApi.count !== 164 || jsonApi.jobs.length !== 164) {
    throw new Error(`API returned count ${jsonApi.count}, expected 164`);
  }
  console.log('PASS: GET /api/gottingen-jobs returns 200 with 164 jobs.');

  // Test /api/export-gottingen-jobs
  const resExport = await app.request('/api/export-gottingen-jobs');
  if (resExport.status !== 200) {
    throw new Error(`/api/export-gottingen-jobs returned status ${resExport.status}`);
  }
  const exportCsv = await resExport.text();
  if (!exportCsv.includes('Excelitas Technologies') || !exportCsv.includes('Sartorius')) {
    throw new Error('Export CSV missing expected employers');
  }
  console.log('PASS: GET /api/export-gottingen-jobs returns valid CSV attachment.');

  console.log('\n=== TEST 2: UI TESTS ===');

  const html = renderDashboardHtml([], []);

  // UI Checks
  if (!html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">')) {
    throw new Error('HTML missing mobile-responsive viewport meta tag');
  }
  console.log('PASS: UI includes mobile viewport meta tag.');

  if (!html.includes('data-tab="gottingenTab"')) {
    throw new Error('HTML missing Göttingen tab button');
  }
  console.log('PASS: UI includes Göttingen tab button.');

  if (!html.includes('id="gottingenTab" class="tab-content active"')) {
    throw new Error('HTML gottingenTab is missing or not active by default');
  }
  console.log('PASS: UI gottingenTab exists and is configured.');

  if (!html.includes('id="gottingenSearchInput"') || !html.includes('id="gottingenLocationSelect"') || !html.includes('id="gottingenCategorySelect"')) {
    throw new Error('HTML missing Göttingen filters');
  }
  console.log('PASS: UI includes search, location, and category filter controls.');

  if (!html.includes('id="gottingenTableBody"')) {
    throw new Error('HTML missing gottingenTableBody');
  }
  console.log('PASS: UI includes gottingenTableBody table container.');

  if (!html.includes('allEnglishJobs =')) {
    throw new Error('HTML script tag missing allEnglishJobs payload');
  }
  console.log('PASS: UI client script contains allEnglishJobs data payload.');

  console.log('\nALL LOGIC AND UI TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});

